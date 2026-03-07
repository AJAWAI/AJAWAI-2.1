import type { ModelStatus } from '../lib/types';
import { getModelProfile, type ModelProfile } from './modelProfiles';

export interface ModelManagerState {
  status: ModelStatus;
  activeModel: ModelProfile | null;
  loadTimeMs: number | null;
  error: string | null;
}

let state: ModelManagerState = {
  status: 'not-loaded',
  activeModel: null,
  loadTimeMs: null,
  error: null,
};

type Listener = (s: ModelManagerState) => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn(state));
}

export function getModelManagerState(): ModelManagerState {
  return state;
}

export function subscribeModelManager(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadModel(modelId: string): Promise<void> {
  const profile = getModelProfile(modelId);
  if (!profile) {
    state = { ...state, status: 'error', error: `Unknown model: ${modelId}` };
    notify();
    return;
  }

  state = { ...state, status: 'loading', error: null };
  notify();

  const start = performance.now();

  try {
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
    const loadTimeMs = performance.now() - start;

    state = {
      status: 'ready',
      activeModel: profile,
      loadTimeMs,
      error: null,
    };
  } catch (e) {
    state = {
      ...state,
      status: 'error',
      error: e instanceof Error ? e.message : 'Failed to load model',
    };
  }

  notify();
}

export function unloadModel(): void {
  state = { status: 'not-loaded', activeModel: null, loadTimeMs: null, error: null };
  notify();
}
