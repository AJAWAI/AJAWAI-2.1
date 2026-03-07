import type { ModelStatus } from '../lib/types';
import { STEP_TARGET, type DeploymentTarget } from './modelProfiles';
import type { ConnectionDiagnostics, RuntimeId } from './runtimeTypes';
import { emptyDiagnostics } from './runtimeTypes';
import {
  createRuntime,
  getActiveRuntime,
  setActiveRuntime,
  getSelectedRuntimeId,
} from './browserLocalAdapter';

export interface ModelManagerState {
  status: ModelStatus;
  activeTarget: DeploymentTarget | null;
  loadTimeMs: number | null;
  error: string | null;
  runtimeConnected: boolean;
  diagnostics: ConnectionDiagnostics;
  selectedRuntime: RuntimeId;
}

let state: ModelManagerState = {
  status: 'not-loaded',
  activeTarget: null,
  loadTimeMs: null,
  error: null,
  runtimeConnected: false,
  diagnostics: emptyDiagnostics(getSelectedRuntimeId()),
  selectedRuntime: getSelectedRuntimeId(),
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

export async function loadModel(ggufVariant?: string): Promise<void> {
  const runtimeId = getSelectedRuntimeId();
  state = {
    ...state,
    status: 'loading',
    error: null,
    activeTarget: STEP_TARGET,
    selectedRuntime: runtimeId,
    diagnostics: emptyDiagnostics(runtimeId),
  };
  notify();

  const runtime = createRuntime(runtimeId, ggufVariant);
  const start = performance.now();

  try {
    await runtime.initialize(STEP_TARGET);

    setActiveRuntime(runtime);
    const loadTimeMs = performance.now() - start;

    state = {
      status: 'ready',
      activeTarget: STEP_TARGET,
      loadTimeMs,
      error: null,
      runtimeConnected: true,
      diagnostics: runtime.getDiagnostics(),
      selectedRuntime: runtimeId,
    };
  } catch (e) {
    setActiveRuntime(null);
    const diag = runtime.getDiagnostics();
    const errorMsg = e instanceof Error ? e.message : `Failed to load ${STEP_TARGET.modelName}`;

    state = {
      status: 'error',
      activeTarget: STEP_TARGET,
      loadTimeMs: null,
      error: errorMsg,
      runtimeConnected: false,
      diagnostics: diag,
      selectedRuntime: runtimeId,
    };
  }

  notify();
}

export async function unloadModel(): Promise<void> {
  const runtime = getActiveRuntime();
  if (runtime) {
    try { await runtime.unload(); } catch { /* best effort */ }
    setActiveRuntime(null);
  }

  const runtimeId = getSelectedRuntimeId();
  state = {
    status: 'not-loaded',
    activeTarget: null,
    loadTimeMs: null,
    error: null,
    runtimeConnected: false,
    diagnostics: emptyDiagnostics(runtimeId),
    selectedRuntime: runtimeId,
  };
  notify();
}
