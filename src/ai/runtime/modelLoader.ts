import type { ModelEntry } from './modelRegistry';

export type LoadStage =
  | 'idle'
  | 'importing'
  | 'downloading'
  | 'initializing'
  | 'ready'
  | 'failed';

export interface LoaderState {
  stage: LoadStage;
  modelId: string | null;
  progress: number;
  error: string | null;
  cached: boolean;
  elapsedMs: number;
}

export function emptyLoaderState(): LoaderState {
  return { stage: 'idle', modelId: null, progress: 0, error: null, cached: false, elapsedMs: 0 };
}

type Pipeline = {
  (text: string, options?: Record<string, unknown>): Promise<{ generated_text: string }[]>;
  dispose?: () => Promise<void>;
};

type TransformersModule = {
  pipeline: (
    task: string,
    model: string,
    options?: Record<string, unknown>,
  ) => Promise<Pipeline>;
  env: { cacheDir: string; allowLocalModels: boolean; backends: { onnx: { wasm: { proxy: boolean } } } };
};

let tfjs: TransformersModule | null = null;
let activePipeline: Pipeline | null = null;
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

export function getActivePipeline(): Pipeline | null { return activePipeline; }
export function getActiveModelId(): string | null { return activeModelId; }

export async function disposeActive(): Promise<void> {
  if (activePipeline?.dispose) {
    try { await activePipeline.dispose(); } catch { /* */ }
  }
  activePipeline = null;
  activeModelId = null;
  loaderState = emptyLoaderState();
  loadStart = 0;
  notify();
}

async function ensureTransformers(): Promise<TransformersModule> {
  if (tfjs) return tfjs;
  const mod = await import('@huggingface/transformers');
  tfjs = mod as unknown as TransformersModule;
  tfjs.env.allowLocalModels = false;
  tfjs.env.backends.onnx.wasm.proxy = false;
  return tfjs;
}

export async function loadModel(entry: ModelEntry): Promise<void> {
  if (activeModelId === entry.modelId && activePipeline) return;

  await disposeActive();

  loadStart = performance.now();
  loaderState = { stage: 'importing', modelId: entry.modelId, progress: 0, error: null, cached: false, elapsedMs: 0 };
  notify();

  let tf: TransformersModule;
  try {
    tf = await ensureTransformers();
  } catch (e) {
    loaderState = { ...loaderState, stage: 'failed', error: `Import failed: ${e instanceof Error ? e.message : String(e)}` };
    notify();
    throw new Error(loaderState.error || 'Import failed');
  }

  loaderState = { ...loaderState, stage: 'downloading', progress: 0 };
  notify();

  const task = entry.supportsVision ? 'image-text-to-text' : 'text-generation';

  try {
    const pipe = await tf.pipeline(task, entry.hfId, {
      device: entry.device,
      dtype: entry.dtype,
      progress_callback: (p: { progress?: number; status?: string }) => {
        if (typeof p.progress === 'number') {
          loaderState.progress = p.progress / 100;
          if (p.status === 'ready') {
            loaderState.stage = 'initializing';
          }
          notify();
        }
      },
    });

    activePipeline = pipe as unknown as Pipeline;
    activeModelId = entry.modelId;
    loaderState = {
      stage: 'ready',
      modelId: entry.modelId,
      progress: 1,
      error: null,
      cached: true,
      elapsedMs: performance.now() - loadStart,
    };
    notify();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    loaderState = { ...loaderState, stage: 'failed', error: msg };
    notify();
    throw new Error(msg);
  }
}
