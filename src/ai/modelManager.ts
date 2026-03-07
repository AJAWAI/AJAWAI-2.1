import type { ModelStatus } from '../lib/types';
import { STEP_MODEL, type ModelProfile } from './modelProfiles';
import { STEP_RUNTIME_CONNECTED } from './browserLocalAdapter';

export interface ModelManagerState {
  status: ModelStatus;
  activeModel: ModelProfile | null;
  loadTimeMs: number | null;
  error: string | null;
  runtimeConnected: boolean;
}

let state: ModelManagerState = {
  status: 'not-loaded',
  activeModel: null,
  loadTimeMs: null,
  error: null,
  runtimeConnected: STEP_RUNTIME_CONNECTED,
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

export async function loadModel(): Promise<void> {
  if (!STEP_RUNTIME_CONNECTED) {
    state = {
      status: 'runtime-unavailable',
      activeModel: STEP_MODEL,
      loadTimeMs: null,
      error: 'STEP-3-VL-10B runtime is not connected yet.',
      runtimeConnected: false,
    };
    notify();
    return;
  }

  state = { ...state, status: 'loading', error: null };
  notify();

  const start = performance.now();

  try {
    // When runtime is wired, actual STEP loading logic goes here
    const loadTimeMs = performance.now() - start;

    state = {
      status: 'ready',
      activeModel: STEP_MODEL,
      loadTimeMs,
      error: null,
      runtimeConnected: true,
    };
  } catch (e) {
    state = {
      ...state,
      status: 'error',
      error: e instanceof Error ? e.message : 'Failed to load STEP-3-VL-10B',
    };
  }

  notify();
}

export function unloadModel(): void {
  state = {
    status: 'not-loaded',
    activeModel: null,
    loadTimeMs: null,
    error: null,
    runtimeConnected: STEP_RUNTIME_CONNECTED,
  };
  notify();
}
