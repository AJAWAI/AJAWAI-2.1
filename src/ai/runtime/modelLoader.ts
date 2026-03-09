import type { ModelEntry } from './modelRegistry';

export type LoadStage =
  | 'idle'
  | 'importing'
  | 'downloading-tokenizer'
  | 'downloading-model'
  | 'initializing'
  | 'smoke-test'
  | 'ready'
  | 'failed';

export interface LoaderState {
  stage: LoadStage;
  modelId: string | null;
  modelPackage: string | null;
  loaderKind: string | null;
  runtime: string | null;
  browserReady: boolean;
  tokenizerProgress: number;
  modelProgress: number;
  combinedProgress: number;
  error: string | null;
  cacheHit: boolean;
  cacheVersion: number;
  smokeTestPassed: boolean;
  elapsedMs: number;
}

export function emptyLoaderState(): LoaderState {
  return {
    stage: 'idle', modelId: null, modelPackage: null, loaderKind: null,
    runtime: null, browserReady: false,
    tokenizerProgress: 0, modelProgress: 0, combinedProgress: 0,
    error: null, cacheHit: false, cacheVersion: 0,
    smokeTestPassed: false, elapsedMs: 0,
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

function notify() {
  if (loadStart > 0) loaderState.elapsedMs = performance.now() - loadStart;
  listeners.forEach((fn) => fn({ ...loaderState }));
}

export function subscribeLoader(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }
export function getLoaderState(): LoaderState {
  if (loadStart > 0) loaderState.elapsedMs = performance.now() - loadStart;
  return { ...loaderState };
}
export function getActiveModel(): TFModel | null { return activeModel; }
export function getActiveTokenizer(): TFTokenizer | null { return activeTokenizer; }
export function getActiveModelId(): string | null { return activeModelId; }

export async function disposeActive(): Promise<void> {
  if (activeModel?.dispose) { try { await activeModel.dispose(); } catch { /* */ } }
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
  invalidateCache(entry);
  try {
    const caches = await globalThis.caches?.keys();
    if (caches) {
      for (const name of caches) {
        if (name.includes('transformers')) await globalThis.caches.delete(name);
      }
    }
  } catch { /* */ }
}

async function ensureTransformers(): Promise<TransformersModule> {
  if (tfjs) return tfjs;
  const mod = await import('@huggingface/transformers');
  tfjs = mod as unknown as TransformersModule;
  return tfjs;
}

async function loadPhiTextWebGPU(entry: ModelEntry): Promise<void> {
  const tf = await ensureTransformers();

  loaderState = { ...loaderState, stage: 'downloading-tokenizer' };
  notify();

  const tokenizer = await tf.AutoTokenizer.from_pretrained(entry.hfId, {
    progress_callback: (p: { progress?: number }) => {
      if (typeof p.progress === 'number') {
        const v = Math.max(peakTokProgress, p.progress / 100);
        peakTokProgress = v;
        loaderState.tokenizerProgress = v;
        updateProgress();
        notify();
      }
    },
  });

  loaderState = { ...loaderState, stage: 'downloading-model', tokenizerProgress: 1 };
  updateProgress();
  notify();

  const model = await tf.AutoModelForCausalLM.from_pretrained(entry.hfId, {
    dtype: entry.dtype,
    device: entry.device,
    progress_callback: (p: { progress?: number }) => {
      if (typeof p.progress === 'number') {
        const v = Math.max(peakModelProgress, p.progress / 100);
        peakModelProgress = v;
        loaderState.modelProgress = v;
        updateProgress();
        notify();
      }
    },
  });

  activeTokenizer = tokenizer;
  activeModel = model;
  activeModelId = entry.modelId;

  loaderState = { ...loaderState, stage: 'initializing', modelProgress: 1, combinedProgress: 1 };
  notify();

  await new Promise((r) => setTimeout(r, 500));

  loaderState = { ...loaderState, stage: 'smoke-test' };
  notify();

  const testInput = activeTokenizer.encode('Hi', { add_special_tokens: true });
  const output = await activeModel.generate({
    input_ids: testInput.input_ids,
    max_new_tokens: 2,
    do_sample: false,
  });
  const decoded = activeTokenizer.decode(output, { skip_special_tokens: true });
  if (!decoded || decoded.length === 0) throw new Error('Smoke test produced empty output');

  loaderState.smokeTestPassed = true;
}

export async function loadModel(entry: ModelEntry): Promise<void> {
  if (!entry.browserReady) {
    throw new Error(`${entry.displayName} is not browser-ready (${entry.loaderKind}). Reserved for future runtime.`);
  }

  if (activeModelId === entry.modelId && activeModel && activeTokenizer) return;

  await disposeActive();

  loadStart = performance.now();
  peakTokProgress = 0;
  peakModelProgress = 0;
  const cacheHit = isCacheValid(entry);

  if (!cacheHit) invalidateCache(entry);

  loaderState = {
    stage: 'importing', modelId: entry.modelId, modelPackage: entry.hfId,
    loaderKind: entry.loaderKind, runtime: entry.device, browserReady: entry.browserReady,
    tokenizerProgress: 0, modelProgress: 0, combinedProgress: 0,
    error: null, cacheHit, cacheVersion: entry.cacheVersion,
    smokeTestPassed: false, elapsedMs: 0,
  };
  notify();

  try {
    if (entry.loaderKind === 'phi-text-webgpu') {
      await loadPhiTextWebGPU(entry);
    } else {
      throw new Error(`Loader '${entry.loaderKind}' not implemented for browser. Model kept in registry for future use.`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (activeModel?.dispose) { try { await activeModel.dispose(); } catch { /* */ } }
    activeModel = null;
    activeTokenizer = null;
    activeModelId = null;
    loaderState = { ...loaderState, stage: 'failed', error: msg };
    notify();
    throw new Error(msg);
  }

  loaderState = {
    ...loaderState, stage: 'ready',
    elapsedMs: performance.now() - loadStart,
  };
  markCacheValid(entry);
  notify();
}
