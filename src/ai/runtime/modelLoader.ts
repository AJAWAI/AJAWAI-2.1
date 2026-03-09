import type { ModelEntry } from './modelRegistry';

export type LoadStage =
  | 'idle'
  | 'importing'
  | 'downloading-tokenizer'
  | 'downloading-model'
  | 'creating-session'
  | 'pre-smoke-delay'
  | 'smoke-test'
  | 'ready'
  | 'failed';

export interface LoaderState {
  stage: LoadStage;
  lastSuccessfulStage: LoadStage;
  modelId: string | null;
  modelPackage: string | null;
  loaderKind: string | null;
  runtime: string | null;
  browserReady: boolean;
  browserReadyGateResult: string;
  tokenizerProgress: number;
  modelProgress: number;
  combinedProgress: number;
  error: string | null;
  cacheHit: boolean;
  cacheClearedThisRun: boolean;
  cacheVersion: number;
  gpuSessionInitialized: boolean;
  aboutToRunSmokeTest: boolean;
  smokeTestPassed: boolean;
  safeLoadMode: boolean;
  elapsedMs: number;
  stageLog: string[];
}

export function emptyLoaderState(): LoaderState {
  return {
    stage: 'idle', lastSuccessfulStage: 'idle',
    modelId: null, modelPackage: null, loaderKind: null,
    runtime: null, browserReady: false, browserReadyGateResult: '',
    tokenizerProgress: 0, modelProgress: 0, combinedProgress: 0,
    error: null, cacheHit: false, cacheClearedThisRun: false, cacheVersion: 0,
    gpuSessionInitialized: false, aboutToRunSmokeTest: false,
    smokeTestPassed: false, safeLoadMode: false, elapsedMs: 0,
    stageLog: [],
  };
}

const CACHE_KEY = 'ajawai_cache_v_';

interface TFModel {
  generate: (input: Record<string, unknown>) => Promise<unknown>;
  dispose?: () => Promise<void>;
}

interface TFTokenizer {
  encode: (text: string, options?: Record<string, unknown>) => { input_ids: unknown };
  decode: (ids: unknown, options?: Record<string, unknown>) => string;
  apply_chat_template?: (messages: { role: string; content: string }[], options?: Record<string, unknown>) => string;
}

interface TransformersModule {
  AutoModelForCausalLM: { from_pretrained: (id: string, opts?: Record<string, unknown>) => Promise<TFModel> };
  AutoTokenizer: { from_pretrained: (id: string, opts?: Record<string, unknown>) => Promise<TFTokenizer> };
}

let tfjs: TransformersModule | null = null;
let activeModel: TFModel | null = null;
let activeTokenizer: TFTokenizer | null = null;
let activeModelId: string | null = null;
let loaderState: LoaderState = emptyLoaderState();
let loadStart = 0;
let peakTokProgress = 0;
let peakModelProgress = 0;

type Listener = (s: LoaderState) => void;
const listeners = new Set<Listener>();

function updateProgress() {
  loaderState.combinedProgress = loaderState.tokenizerProgress * 0.1 + loaderState.modelProgress * 0.9;
}

function log(msg: string) {
  const ts = loadStart > 0 ? `[${((performance.now() - loadStart) / 1000).toFixed(1)}s]` : '[0s]';
  loaderState.stageLog = [...loaderState.stageLog.slice(-19), `${ts} ${msg}`];
}

function setStage(stage: LoadStage, msg?: string) {
  loaderState.lastSuccessfulStage = loaderState.stage === 'failed' ? loaderState.lastSuccessfulStage : loaderState.stage;
  loaderState.stage = stage;
  log(msg ?? stage);
  notify();
}

function notify() {
  if (loadStart > 0) loaderState.elapsedMs = performance.now() - loadStart;
  listeners.forEach((fn) => fn({ ...loaderState, stageLog: [...loaderState.stageLog] }));
}

export function subscribeLoader(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }
export function getLoaderState(): LoaderState {
  if (loadStart > 0) loaderState.elapsedMs = performance.now() - loadStart;
  return { ...loaderState, stageLog: [...loaderState.stageLog] };
}
export function getActiveModel(): TFModel | null { return activeModel; }
export function getActiveTokenizer(): TFTokenizer | null { return activeTokenizer; }
export function getActiveModelId(): string | null { return activeModelId; }

export async function disposeActive(): Promise<void> {
  if (activeModel?.dispose) {
    try { log('Disposing active model'); await activeModel.dispose(); log('Model disposed'); } catch { log('Dispose error (ignored)'); }
  }
  activeModel = null;
  activeTokenizer = null;
  activeModelId = null;
  loaderState = emptyLoaderState();
  loadStart = 0;
  peakTokProgress = 0;
  peakModelProgress = 0;
  notify();
}

function isCacheValid(entry: ModelEntry): boolean {
  try {
    const v = localStorage.getItem(CACHE_KEY + entry.modelId);
    return v !== null && parseInt(v) === entry.cacheVersion;
  } catch { return false; }
}

function invalidateCache(entry: ModelEntry) {
  try { localStorage.removeItem(CACHE_KEY + entry.modelId); } catch { /* */ }
}

function markCacheValid(entry: ModelEntry) {
  try { localStorage.setItem(CACHE_KEY + entry.modelId, String(entry.cacheVersion)); } catch { /* */ }
}

export async function clearModelCache(entry: ModelEntry): Promise<void> {
  const modelId = entry.modelId;
  log(`Clearing cache for ${modelId}...`);
  
  // 1. Clear localStorage version marker
  invalidateCache(entry);
  
  // 2. Aggressively clear all relevant browser caches
  try {
    const keys = await globalThis.caches?.keys();
    if (keys) {
      let cleared = 0;
      for (const name of keys) {
        // Clear any cache that might contain model artifacts
        if (
          name.includes('transformers') ||
          name.includes('onnx') ||
          name.includes('hf') ||  // HuggingFace
          name.includes('model') ||
          name.includes(entry.hfId.split('/')[0]) || // Clear by org name (onnx-community)
          name.includes('ajawai')
        ) {
          await globalThis.caches.delete(name);
          cleared++;
        }
      }
      log(`Cleared ${cleared} caches`);
    }
  } catch (e) {
    log(`Cache clear error: ${e instanceof Error ? e.message : String(e)}`);
  }
  
  // 3. Force reload to ensure clean state
  log(`Cache cleared for ${modelId} - reload may be needed`);
}

async function ensureTransformers(): Promise<TransformersModule> {
  if (tfjs) return tfjs;
  log('Dynamic import @huggingface/transformers');
  const mod = await import('@huggingface/transformers');
  tfjs = mod as unknown as TransformersModule;
  log('Transformers.js module loaded');
  return tfjs;
}

async function loadPhiTextWebGPU(entry: ModelEntry, safeMode: boolean): Promise<void> {
  let tf: TransformersModule;
  try {
    tf = await ensureTransformers();
  } catch (e) {
    throw new Error(`Transformers.js import failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  setStage('downloading-tokenizer', `Loading tokenizer from ${entry.hfId}`);
  let tokenizer: TFTokenizer;
  try {
    tokenizer = await tf.AutoTokenizer.from_pretrained(entry.hfId, {
      progress_callback: (p: { progress?: number }) => {
        if (typeof p.progress === 'number') {
          peakTokProgress = Math.max(peakTokProgress, p.progress / 100);
          loaderState.tokenizerProgress = peakTokProgress;
          updateProgress();
          notify();
        }
      },
    });
    log('Tokenizer loaded successfully');
  } catch (e) {
    throw new Error(`Tokenizer load failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  setStage('downloading-model', `Loading model ONNX (${entry.dtype}, ${entry.device})`);
  loaderState.tokenizerProgress = 1;
  updateProgress();
  notify();

  let model: TFModel;
  try {
    model = await tf.AutoModelForCausalLM.from_pretrained(entry.hfId, {
      dtype: entry.dtype,
      device: entry.device,
      progress_callback: (p: { progress?: number }) => {
        if (typeof p.progress === 'number') {
          peakModelProgress = Math.max(peakModelProgress, p.progress / 100);
          loaderState.modelProgress = peakModelProgress;
          updateProgress();
          notify();
        }
      },
    });
    log('Model ONNX files loaded');
  } catch (e) {
    throw new Error(`Model load failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  activeTokenizer = tokenizer;
  activeModel = model;
  activeModelId = entry.modelId;

  setStage('creating-session', 'GPU session created, model in memory');
  loaderState.modelProgress = 1;
  loaderState.combinedProgress = 1;
  loaderState.gpuSessionInitialized = true;
  notify();

  const delayMs = safeMode ? 1500 : 500;
  setStage('pre-smoke-delay', `Waiting ${delayMs}ms before smoke test (safe=${safeMode})`);
  await new Promise((r) => setTimeout(r, delayMs));

  // Skip smoke test in safe mode - let first user message be the live readiness test
  // This prevents mobile browser crashes from inference memory spike
  if (safeMode) {
    loaderState.smokeTestPassed = false; // Not passed, just skipped
    log('Smoke test SKIPPED in safe mode - first user prompt will be live test');
    loaderState.lastSuccessfulStage = 'pre-smoke-delay';
    notify();
    return;
  }

  loaderState.aboutToRunSmokeTest = true;
  setStage('smoke-test', 'Running smoke test: generate 1 token from "Hi"');

  try {
    const testInput = activeTokenizer.encode('Hi', { add_special_tokens: true });
    log('Smoke test: encoded input, calling generate(max_new_tokens=1)');
    const output = await activeModel.generate({
      input_ids: testInput.input_ids,
      max_new_tokens: 1,
      do_sample: false,
    });
    
    // Handle Tensor output from Transformers.js ONNX
    let outputArray: unknown[];
    if (output && typeof output === 'object' && 'tolist' in output && typeof (output as { tolist: () => unknown }).tolist === 'function') {
      outputArray = (output as { tolist: () => unknown[] }).tolist();
    } else if (Array.isArray(output)) {
      outputArray = output;
    } else {
      throw new Error(`Unexpected generate() output type: ${typeof output}`);
    }
    
    const decoded = activeTokenizer.decode(outputArray, { skip_special_tokens: true });
    log(`Smoke test output: "${decoded.slice(0, 40)}"`);
    if (!decoded || decoded.length === 0) throw new Error('Smoke test produced empty output');
    loaderState.smokeTestPassed = true;
    log('Smoke test PASSED');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`Smoke test FAILED: ${msg}`);
    throw new Error(`Smoke test failed: ${msg}`);
  }
}

export async function loadModel(entry: ModelEntry, safeMode: boolean = false): Promise<void> {
  if (!entry.browserReady) {
    const reason = `${entry.displayName} (${entry.loaderKind}) — not browser-ready. Reserved for future runtime.`;
    loaderState.browserReadyGateResult = `BLOCKED: ${reason}`;
    throw new Error(reason);
  }

  if (activeModelId === entry.modelId && activeModel && activeTokenizer) {
    log('Model already loaded, skipping');
    return;
  }

  await disposeActive();

  loadStart = performance.now();
  peakTokProgress = 0;
  peakModelProgress = 0;
  const cacheHit = isCacheValid(entry);
  let cacheClearedThisRun = false;

  if (!cacheHit) {
    invalidateCache(entry);
    cacheClearedThisRun = true;
  }

  loaderState = {
    ...emptyLoaderState(),
    stage: 'importing', modelId: entry.modelId, modelPackage: entry.hfId,
    loaderKind: entry.loaderKind, runtime: entry.device, browserReady: entry.browserReady,
    browserReadyGateResult: `PASSED: ${entry.loaderKind}`,
    cacheHit, cacheClearedThisRun, cacheVersion: entry.cacheVersion,
    safeLoadMode: safeMode,
    stageLog: [`[0s] Starting ${entry.displayName} (${entry.loaderKind}, safe=${safeMode})`],
  };
  notify();

  try {
    if (entry.loaderKind === 'phi-text-webgpu') {
      await loadPhiTextWebGPU(entry, safeMode);
    } else {
      throw new Error(`Loader '${entry.loaderKind}' not implemented. Model in registry for future use.`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`FATAL: ${msg}`);
    if (activeModel?.dispose) { try { await activeModel.dispose(); } catch { /* */ } }
    activeModel = null;
    activeTokenizer = null;
    activeModelId = null;
    loaderState = { ...loaderState, stage: 'failed', error: msg };
    notify();
    throw new Error(msg);
  }

  setStage('ready', `${entry.displayName} ready`);
  markCacheValid(entry);
  
  // Final detailed logging for debugging
  log(`===== LOAD COMPLETE =====`);
  log(`Model: ${entry.displayName} (${entry.modelId})`);
  log(`Quantization: ${entry.quantization} | Est. RAM: ${entry.estimatedRAM_GB}GB`);
  log(`Safe mode: ${safeMode} | Smoke test: ${safeMode ? 'SKIPPED' : loaderState.smokeTestPassed ? 'PASSED' : 'FAILED'}`);
  log(`GPU Session: ${loaderState.gpuSessionInitialized ? 'INITIALIZED' : 'NOT INITIALIZED'}`);
  log(`Total load time: ${((loaderState.elapsedMs || 0) / 1000).toFixed(2)}s`);
  log(`Browser memory: Check DevTools Performance tab`);
  log(`==========================`);
  
  notify();
}
