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
  emptyLoaderState,
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
  stepModel: ModelEntry;
  fallbackTriggered: boolean;
  fallbackReason: string | null;
  error: string | null;
  loader: LoaderState;
  visionActive: boolean;
}

let state: OrchestratorState = {
  status: 'idle', device: null, tier: null, activeModel: null,
  reasoningModel: PHI35_Q4, visionModel: MOONDREAM_Q4, stepModel: STEP_Q4,
  fallbackTriggered: false, fallbackReason: null,
  error: null, loader: emptyLoaderState(), visionActive: false,
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

export async function connect(safeMode: boolean = false): Promise<void> {
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

  state = { ...state, status: 'loading', activeModel: PHI35_Q4 };
  notify();

  try {
    await loadModel(PHI35_Q4, safeMode);
    state = { ...state, status: 'ready', activeModel: PHI35_Q4 };
    notify();
  } catch (e) {
    state = {
      ...state, status: 'error', activeModel: null,
      error: `${PHI35_Q4.displayName}: ${e instanceof Error ? e.message : String(e)}`,
    };
    notify();
  }
}

export async function switchToVision(): Promise<boolean> {
  if (!MOONDREAM_Q4.browserReady) return false;
  state = { ...state, status: 'switching', activeModel: MOONDREAM_Q4 };
  notify();
  try {
    await loadModel(MOONDREAM_Q4);
    state = { ...state, status: 'ready', activeModel: MOONDREAM_Q4, visionActive: true };
    notify();
    return true;
  } catch {
    state = { ...state, status: 'loading', activeModel: PHI35_Q4 };
    notify();
    try { await loadModel(PHI35_Q4); } catch { /* */ }
    state = { ...state, status: 'ready', visionActive: false };
    notify();
    return false;
  }
}

export async function switchToReasoning(): Promise<void> {
  if (getActiveModelId() === PHI35_Q4.modelId) return;
  state = { ...state, status: 'switching', activeModel: PHI35_Q4 };
  notify();
  try { await loadModel(PHI35_Q4); } catch { /* */ }
  state = { ...state, status: 'ready', activeModel: PHI35_Q4, visionActive: false };
  notify();
}

export async function disconnect(): Promise<void> {
  await disposeActive();
  state = {
    status: 'idle', device: state.device, tier: state.tier,
    activeModel: null, reasoningModel: PHI35_Q4, visionModel: MOONDREAM_Q4,
    stepModel: STEP_Q4, fallbackTriggered: false, fallbackReason: null,
    error: null, loader: emptyLoaderState(), visionActive: false,
  };
  notify();
}

export async function generate(prompt: string, maxTokens: number = 128): Promise<string> {
  const model = getActiveModel();
  const tokenizer = getActiveTokenizer();
  if (!model || !tokenizer) throw new Error('No model loaded');

  let formatted = prompt;
  if (tokenizer.apply_chat_template) {
    try {
      formatted = tokenizer.apply_chat_template(
        [{ role: 'user', content: prompt }],
        { add_generation_prompt: true, tokenize: false },
      );
    } catch { /* use raw */ }
  }

  const inputs = tokenizer.encode(formatted, { add_special_tokens: true });
  const output = await model.generate({
    input_ids: inputs.input_ids,
    max_new_tokens: maxTokens,
    do_sample: true,
    temperature: 0.7,
  });
  const text = tokenizer.decode(output, { skip_special_tokens: true });

  const promptEnd = text.lastIndexOf(prompt);
  if (promptEnd >= 0) return text.slice(promptEnd + prompt.length).trim();
  return text.trim();
}
