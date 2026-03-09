import type { ModelEntry } from './modelRegistry';

export type LoadStage =
  | 'idle'
  | 'importing'
  | 'downloading'
  | 'initializing'
  | 'smoke-test'
  | 'ready'
  | 'failed';

export interface LoaderState {
  stage: LoadStage;
  modelId: string | null;
  modelPackage: string | null;
  runtime: string | null;
  progress: number;
  error: string | null;
  cached: boolean;
  cacheVersion: number;
  smokeTestPassed: boolean;
  elapsedMs: number;
}

export function emptyLoaderState(): LoaderState {
  return {
    stage: 'idle', modelId: null, modelPackage: null, runtime: null,
    progress: 0, error: null, cached: false, cacheVersion: 0,
    smokeTestPassed: false, elapsedMs: 0,
  };
}

const CACHE_KEY = 'ajawai_model_cache_v';

interface TFModel {
  generate: (input: { input_ids: unknown; max_new_tokens?: number; do_sample?: boolean; temperature?: number }) => Promise<unknown>;
  dispose?: () => Promise<void>;
}

interface TFTokenizer {
  encode: (text: string, options?: Record<string, unknown>) => { input_ids: unknown };
  decode: (ids: unknown, options?: Record<string, unknown>) => string;
  apply_chat_template?: (messages: { role: string; content: string }[], options?: Record<string, unknown>) => string;
}

interface TransformersModule {
  AutoModelForCausalLM: {
    from_pretrained: (id: string, opts?: Record<string, unknown>) => Promise<TFModel>;
  };
  AutoTokenizer: {
    from_pretrained: (id: string, opts?: Record<string, unknown>) => Promise<TFTokenizer>;
  };
  env: Record<string, unknown>;
}

let tfjs: TransformersModule | null = null;
let activeModel: TFModel | null = null;
let activeTokenizer: TFTokenizer | null = null;
let activeModelId: string | null = null;
let loaderState: LoaderState = emptyLoaderState();
let loadStart = 0;

type Listener = (s: LoaderState) => void;
const listeners = new Set<Listener>();

function notify() {
  if (loadStart > 0) loaderState.elapsedMs = performance.now() - loadStart;
  listeners.forEach((fn) => fn({ ...loaderState }));
}

export function subscribeLoader(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getLoaderState(): LoaderState {
  if (loadStart > 0) loaderState.elapsedMs = performance.now() - loadStart;
  return { ...loaderState };
}

export function getActiveModel(): TFModel | null { return activeModel; }
export function getActiveTokenizer(): TFTokenizer | null { return activeTokenizer; }
export function getActiveModelId(): string | null { return activeModelId; }

export async function disposeActive(): Promise<void> {
  if (activeModel?.dispose) {
    try { await activeModel.dispose(); } catch { /* */ }
  }
  activeModel = null;
  activeTokenizer = null;
  activeModelId = null;
  loaderState = emptyLoaderState();
  loadStart = 0;
  notify();
}

function checkCacheVersion(entry: ModelEntry): boolean {
  try {
    const stored = localStorage.getItem(CACHE_KEY + entry.modelId);
    if (stored && parseInt(stored) === entry.cacheVersion) return true;
    if (stored && parseInt(stored) !== entry.cacheVersion) {
      localStorage.removeItem(CACHE_KEY + entry.modelId);
    }
  } catch { /* */ }
  return false;
}

function setCacheVersion(entry: ModelEntry) {
  try { localStorage.setItem(CACHE_KEY + entry.modelId, String(entry.cacheVersion)); } catch { /* */ }
}

async function ensureTransformers(): Promise<TransformersModule> {
  if (tfjs) return tfjs;
  const mod = await import('@huggingface/transformers');
  tfjs = mod as unknown as TransformersModule;
  return tfjs;
}

export async function loadModel(entry: ModelEntry): Promise<void> {
  if (activeModelId === entry.modelId && activeModel && activeTokenizer) return;

  await disposeActive();

  loadStart = performance.now();
  const isCached = checkCacheVersion(entry);
  loaderState = {
    stage: 'importing', modelId: entry.modelId, modelPackage: entry.hfId,
    runtime: entry.device, progress: 0, error: null,
    cached: isCached, cacheVersion: entry.cacheVersion,
    smokeTestPassed: false, elapsedMs: 0,
  };
  notify();

  let tf: TransformersModule;
  try {
    tf = await ensureTransformers();
  } catch (e) {
    loaderState = { ...loaderState, stage: 'failed', error: `Transformers.js import failed: ${e instanceof Error ? e.message : String(e)}` };
    notify();
    throw new Error(loaderState.error || 'Import failed');
  }

  loaderState = { ...loaderState, stage: 'downloading' };
  notify();

  try {
    const [tokenizer, model] = await Promise.all([
      tf.AutoTokenizer.from_pretrained(entry.hfId, {
        progress_callback: (p: { progress?: number }) => {
          if (typeof p.progress === 'number') {
            loaderState.progress = Math.min(p.progress / 100, 0.5);
            notify();
          }
        },
      }),
      tf.AutoModelForCausalLM.from_pretrained(entry.hfId, {
        dtype: entry.dtype,
        device: entry.device,
        progress_callback: (p: { progress?: number }) => {
          if (typeof p.progress === 'number') {
            loaderState.progress = 0.5 + (p.progress / 100) * 0.5;
            notify();
          }
        },
      }),
    ]);

    activeTokenizer = tokenizer;
    activeModel = model;
    activeModelId = entry.modelId;

    loaderState = { ...loaderState, stage: 'initializing', progress: 1 };
    notify();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    loaderState = { ...loaderState, stage: 'failed', error: `Model load failed: ${msg}` };
    notify();
    throw new Error(loaderState.error || 'Load failed');
  }

  loaderState = { ...loaderState, stage: 'smoke-test' };
  notify();

  try {
    const testInput = activeTokenizer.encode('Hi', { add_special_tokens: true });
    const output = await activeModel.generate({
      input_ids: testInput.input_ids,
      max_new_tokens: 4,
      do_sample: false,
    });
    const decoded = activeTokenizer.decode(output, { skip_special_tokens: true });
    if (!decoded || decoded.length === 0) throw new Error('Empty smoke-test output');

    loaderState = {
      ...loaderState, stage: 'ready', smokeTestPassed: true, cached: true,
      elapsedMs: performance.now() - loadStart,
    };
    setCacheVersion(entry);
    notify();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    activeModel = null;
    activeTokenizer = null;
    activeModelId = null;
    loaderState = { ...loaderState, stage: 'failed', error: `Smoke-test failed: ${msg}` };
    notify();
    throw new Error(loaderState.error || 'Smoke-test failed');
  }
}
