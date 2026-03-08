import { detectDevice, classifyTier, type DeviceProfile, type DeviceTier } from './deviceCapability';
import { PHI35_Q4, MOONDREAM_Q4, STEP_Q4, type ModelEntry } from './modelRegistry';
import {
  loadModel,
  disposeActive,
  getActivePipeline,
  getActiveModelId,
  getLoaderState,
  subscribeLoader,
  type LoaderState,
} from './modelLoader';

export type OrchestratorStatus =
  | 'idle'
  | 'detecting'
  | 'loading'
  | 'ready'
  | 'switching'
  | 'error';

export interface OrchestratorState {
  status: OrchestratorStatus;
  device: DeviceProfile | null;
  tier: DeviceTier | null;
  activeModel: ModelEntry | null;
  reasoningModel: ModelEntry;
  visionModel: ModelEntry;
  stepAvailable: boolean;
  fallbackTriggered: boolean;
  fallbackReason: string | null;
  error: string | null;
  loader: LoaderState;
  visionDisabled: boolean;
}

let state: OrchestratorState = {
  status: 'idle',
  device: null,
  tier: null,
  activeModel: null,
  reasoningModel: PHI35_Q4,
  visionModel: MOONDREAM_Q4,
  stepAvailable: false,
  fallbackTriggered: false,
  fallbackReason: null,
  error: null,
  loader: { stage: 'idle', modelId: null, progress: 0, error: null, cached: false, elapsedMs: 0 },
  visionDisabled: false,
};

type Listener = (s: OrchestratorState) => void;
const subs = new Set<Listener>();
function notify() { subs.forEach((fn) => fn({ ...state, loader: getLoaderState() })); }

export function getOrchestratorState(): OrchestratorState {
  return { ...state, loader: getLoaderState() };
}

export function subscribeOrchestrator(fn: Listener) {
  subs.add(fn);
  const unsubLoader = subscribeLoader(() => notify());
  return () => { subs.delete(fn); unsubLoader(); };
}

async function tryLoad(entry: ModelEntry): Promise<boolean> {
  try {
    await loadModel(entry);
    return true;
  } catch {
    await disposeActive();
    return false;
  }
}

export async function connect(): Promise<void> {
  state = { ...state, status: 'detecting', error: null, fallbackTriggered: false, fallbackReason: null };
  notify();

  const device = await detectDevice();
  const tier = classifyTier(device);
  state = { ...state, device, tier };

  if (!device.hasWebGPU) {
    state = { ...state, status: 'error', error: 'WebGPU not available. Requires Chrome 113+ with WebGPU enabled.' };
    notify();
    return;
  }

  state = { ...state, status: 'loading' };
  notify();

  if (tier === 'high') {
    state.activeModel = STEP_Q4;
    notify();
    const ok = await tryLoad(STEP_Q4);
    if (ok) {
      state = { ...state, status: 'ready', activeModel: STEP_Q4, stepAvailable: true, visionDisabled: false };
      notify();
      return;
    }
    state = { ...state, fallbackTriggered: true, fallbackReason: `STEP failed: ${getLoaderState().error}. Falling back to dual model system.` };
    notify();
  }

  if (tier === 'low') {
    state = { ...state, visionDisabled: true };
  }

  state.activeModel = PHI35_Q4;
  notify();
  const phiOk = await tryLoad(PHI35_Q4);
  if (phiOk) {
    state = { ...state, status: 'ready', activeModel: PHI35_Q4 };
    notify();
    return;
  }

  state = {
    ...state,
    status: 'error',
    error: `Failed to load ${PHI35_Q4.displayName}: ${getLoaderState().error}`,
  };
  notify();
}

export async function switchToVision(): Promise<boolean> {
  if (state.visionDisabled) return false;
  state = { ...state, status: 'switching', activeModel: MOONDREAM_Q4 };
  notify();
  const ok = await tryLoad(MOONDREAM_Q4);
  if (ok) {
    state = { ...state, status: 'ready', activeModel: MOONDREAM_Q4 };
    notify();
    return true;
  }
  state = { ...state, status: 'loading', activeModel: PHI35_Q4 };
  notify();
  await tryLoad(PHI35_Q4);
  state = { ...state, status: 'ready' };
  notify();
  return false;
}

export async function switchToReasoning(): Promise<void> {
  if (getActiveModelId() === PHI35_Q4.modelId) return;
  state = { ...state, status: 'switching', activeModel: PHI35_Q4 };
  notify();
  await tryLoad(PHI35_Q4);
  state = { ...state, status: 'ready', activeModel: PHI35_Q4 };
  notify();
}

export async function disconnect(): Promise<void> {
  await disposeActive();
  state = {
    status: 'idle', device: state.device, tier: state.tier,
    activeModel: null, reasoningModel: PHI35_Q4, visionModel: MOONDREAM_Q4,
    stepAvailable: false, fallbackTriggered: false, fallbackReason: null,
    error: null, loader: { stage: 'idle', modelId: null, progress: 0, error: null, cached: false, elapsedMs: 0 },
    visionDisabled: false,
  };
  notify();
}

export async function generate(prompt: string, maxTokens: number = 128): Promise<string> {
  const pipe = getActivePipeline();
  if (!pipe) throw new Error('No model loaded');
  const result = await pipe(prompt, { max_new_tokens: maxTokens, temperature: 0.7, do_sample: true });
  if (Array.isArray(result) && result[0]?.generated_text) {
    return result[0].generated_text;
  }
  return String(result);
}
