import type { ModelStatus } from '../lib/types';
import type { ConnectionDiagnostics } from './runtimeTypes';
import { emptyDiagnostics } from './runtimeTypes';
import { type ModelProfile, getFallbackTier, getProfileForTier } from './modelProfiles';
import { selectModel } from './modelSelector';
import type { DeviceTier } from './deviceCapability';
import { WllamaRuntime } from './wllamaRuntime';

let activeRuntime: WllamaRuntime | null = null;

export interface ModelManagerState {
  status: ModelStatus;
  activeProfile: ModelProfile | null;
  loadTimeMs: number | null;
  error: string | null;
  runtimeConnected: boolean;
  diagnostics: ConnectionDiagnostics;
  fallbackTriggered: boolean;
  fallbackReason: string | null;
  selectionReason: string | null;
}

let state: ModelManagerState = {
  status: 'not-loaded',
  activeProfile: null,
  loadTimeMs: null,
  error: null,
  runtimeConnected: false,
  diagnostics: emptyDiagnostics('wllama'),
  fallbackTriggered: false,
  fallbackReason: null,
  selectionReason: null,
};

type Listener = (s: ModelManagerState) => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach((fn) => fn(state)); }

export function getModelManagerState() { return state; }
export function subscribeModelManager(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }

async function tryLoadProfile(profile: ModelProfile): Promise<{ ok: boolean; error?: string }> {
  const runtime = new WllamaRuntime();
  const start = performance.now();

  const poll = setInterval(() => {
    const d = runtime.getDiagnostics();
    if (d.stage !== state.diagnostics.stage || d.subStatus !== state.diagnostics.subStatus ||
        Math.abs(d.downloadProgress - state.diagnostics.downloadProgress) > 0.005) {
      state = { ...state, diagnostics: { ...d, activeProfile: profile } };
      notify();
    }
  }, 250);

  try {
    await runtime.initialize(profile);
    clearInterval(poll);
    activeRuntime = runtime;
    state = {
      status: 'ready',
      activeProfile: profile,
      loadTimeMs: performance.now() - start,
      error: null,
      runtimeConnected: true,
      diagnostics: runtime.getDiagnostics(),
      fallbackTriggered: state.fallbackTriggered,
      fallbackReason: state.fallbackReason,
      selectionReason: state.selectionReason,
    };
    notify();
    return { ok: true };
  } catch (e) {
    clearInterval(poll);
    try { await runtime.unload(); } catch { /* */ }
    const msg = e instanceof Error ? e.message : String(e);
    state = { ...state, diagnostics: runtime.getDiagnostics() };
    notify();
    return { ok: false, error: msg };
  }
}

export async function loadModel(): Promise<void> {
  state = {
    ...state, status: 'loading', error: null,
    fallbackTriggered: false, fallbackReason: null,
    diagnostics: { ...emptyDiagnostics('wllama'), stage: 'selecting-model', subStatus: 'Detecting device…' },
  };
  notify();

  const selection = await selectModel();
  state.selectionReason = selection.reason;
  let currentTier: DeviceTier | null = selection.tier;
  let attempt = 0;

  while (currentTier) {
    const profile = selection.tier === currentTier ? selection.profile
      : getProfileForTier(currentTier);

    if (attempt > 0) {
      state.fallbackTriggered = true;
      state.fallbackReason = `${state.error} → falling back to ${profile.displayName}`;
    }

    state = {
      ...state, status: 'loading', error: null, activeProfile: profile,
      diagnostics: { ...emptyDiagnostics('wllama'), activeProfile: profile, subStatus: `Trying ${profile.displayName}…` },
    };
    notify();

    const result = await tryLoadProfile(profile);
    if (result.ok) return;

    state.error = result.error ?? 'Unknown error';
    currentTier = getFallbackTier(currentTier);
    attempt++;
  }

  state = { ...state, status: 'error', runtimeConnected: false };
  notify();
}

export async function unloadModel(): Promise<void> {
  if (activeRuntime) {
    try { await activeRuntime.unload(); } catch { /* */ }
    activeRuntime = null;
  }
  state = {
    status: 'not-loaded', activeProfile: null, loadTimeMs: null, error: null,
    runtimeConnected: false, diagnostics: emptyDiagnostics('wllama'),
    fallbackTriggered: false, fallbackReason: null, selectionReason: null,
  };
  notify();
}

export function getActiveRuntime(): WllamaRuntime | null { return activeRuntime; }
