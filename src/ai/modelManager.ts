import type { ModelStatus } from '../lib/types';
import { STEP_TARGET, type DeploymentTarget } from './modelProfiles';
import { STEP_RUNTIME_CONNECTED } from './browserLocalAdapter';

export interface ModelManagerState {
  status: ModelStatus;
  activeTarget: DeploymentTarget | null;
  loadTimeMs: number | null;
  error: string | null;
  runtimeConnected: boolean;
}

let state: ModelManagerState = {
  status: 'not-loaded',
  activeTarget: null,
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
      activeTarget: STEP_TARGET,
      loadTimeMs: null,
      error: `${STEP_TARGET.modelName} (${STEP_TARGET.quantization}) runtime is not connected yet.`,
      runtimeConnected: false,
    };
    notify();
    return;
  }

  state = { ...state, status: 'loading', error: null };
  notify();

  const start = performance.now();

  try {
    const loadTimeMs = performance.now() - start;
    state = {
      status: 'ready',
      activeTarget: STEP_TARGET,
      loadTimeMs,
      error: null,
      runtimeConnected: true,
    };
  } catch (e) {
    state = {
      ...state,
      status: 'error',
      error: e instanceof Error ? e.message : `Failed to load ${STEP_TARGET.modelName}`,
    };
  }

  notify();
}

export function unloadModel(): void {
  state = {
    status: 'not-loaded',
    activeTarget: null,
    loadTimeMs: null,
    error: null,
    runtimeConnected: STEP_RUNTIME_CONNECTED,
  };
  notify();
}
