import { detectDevice, classifyTier, type DeviceProfile, type DeviceTier } from './deviceCapability';
import { PHI35_Q4, MOONDREAM_Q4, STEP_Q4, type ModelEntry } from './modelRegistry';
import {
  loadModel,
  disposeActive,
  getActiveModel,
  getActiveTokenizer,
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

const INITIAL_LOADER: LoaderState = {
  stage: 'idle', modelId: null, modelPackage: null, runtime: null,
  progress: 0, error: null, cached: false, cacheVersion: 0,
  smokeTestPassed: false, elapsedMs: 0,
};

let state: OrchestratorState = {
  status: 'idle', device: null, tier: null, activeModel: null,
  reasoningModel: PHI35_Q4, visionModel: MOONDREAM_Q4,
  stepAvailable: false, fallbackTriggered: false, fallbackReason: null,
  error: null, loader: INITIAL_LOADER, visionDisabled: false,
};

type Listener = (s: OrchestratorState) => void;
const subs = new Set<Listener>();
function notify() { subs.forEach((fn) => fn({ ...state, loader: getLoaderState() })); }

export function getOrchestratorState(): OrchestratorState {
  return { ...state, loader: getLoaderState() };
}

export function subscribeOrchestrator(fn: Listener) {
  subs.add(fn);
  const unsub = subscribeLoader(() => notify());
  return () => { subs.delete(fn); unsub(); };
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
    state = { ...state, status: 'error', error: 'WebGPU not available. Requires Chrome 113+ or Edge with WebGPU flag enabled.' };
    notify();
    return;
  }

  state = { ...state, status: 'loading' };
  notify();

  if (tier === 'high') {
    state.activeModel = STEP_Q4;
    notify();
    if (await tryLoad(STEP_Q4)) {
      state = { ...state, status: 'ready', activeModel: STEP_Q4, stepAvailable: true };
      notify();
      return;
    }
    state = { ...state, fallbackTriggered: true, fallbackReason: `STEP failed: ${getLoaderState().error}` };
    notify();
  }

  if (tier === 'low') state.visionDisabled = true;

  state.activeModel = PHI35_Q4;
  notify();
  if (await tryLoad(PHI35_Q4)) {
    state = { ...state, status: 'ready', activeModel: PHI35_Q4 };
    notify();
    return;
  }

  state = { ...state, status: 'error', error: `${PHI35_Q4.displayName}: ${getLoaderState().error}` };
  notify();
}

export async function switchToVision(): Promise<boolean> {
  if (state.visionDisabled) return false;
  state = { ...state, status: 'switching', activeModel: MOONDREAM_Q4 };
  notify();
  if (await tryLoad(MOONDREAM_Q4)) {
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
    error: null, loader: INITIAL_LOADER, visionDisabled: false,
  };
  notify();
}

export async function generate(prompt: string, maxTokens: number = 128): Promise<string> {
  const model = getActiveModel();
  const tokenizer = getActiveTokenizer();
  if (!model || !tokenizer) throw new Error('No model loaded');

  let formattedPrompt = prompt;
  if (tokenizer.apply_chat_template) {
    try {
      formattedPrompt = tokenizer.apply_chat_template(
        [{ role: 'user', content: prompt }],
        { add_generation_prompt: true, tokenize: false },
      );
    } catch { /* use raw prompt */ }
  }

  const inputs = tokenizer.encode(formattedPrompt, { add_special_tokens: true });
  const output = await model.generate({
    input_ids: inputs.input_ids,
    max_new_tokens: maxTokens,
    do_sample: true,
    temperature: 0.7,
  });
  const text = tokenizer.decode(output, { skip_special_tokens: true });

  const idx = text.indexOf(prompt);
  if (idx >= 0) {
    return text.slice(idx + prompt.length).trim();
  }
  return text.trim();
}
