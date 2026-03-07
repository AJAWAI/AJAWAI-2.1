import { create } from 'zustand';
import type { DeviceCapabilities, ModelStatus } from '../lib/types';
import type { ConnectionDiagnostics } from '../ai/runtimeTypes';
import { emptyDiagnostics } from '../ai/runtimeTypes';
import { detectCapabilities } from '../ai/capabilityDetect';
import {
  loadModel as loadModelManager,
  unloadModel as unloadModelManager,
  getModelManagerState,
  subscribeModelManager,
} from '../ai/modelManager';
import { STEP_TARGET } from '../ai/modelProfiles';

interface ModelState {
  status: ModelStatus;
  modelName: string;
  quantization: string;
  contextWindow: number;
  loadTimeMs: number | null;
  error: string | null;
  runtimeConnected: boolean;
  diagnostics: ConnectionDiagnostics;
  capabilities: DeviceCapabilities | null;
  capabilitiesLoading: boolean;

  detectCapabilities: () => Promise<void>;
  loadModel: () => Promise<void>;
  unloadModel: () => Promise<void>;
  initSubscription: () => () => void;
}

export const useModelStore = create<ModelState>((set) => ({
  status: 'not-loaded',
  modelName: STEP_TARGET.modelName,
  quantization: STEP_TARGET.quantization,
  contextWindow: STEP_TARGET.contextWindow,
  loadTimeMs: null,
  error: null,
  runtimeConnected: false,
  diagnostics: emptyDiagnostics('webllm'),
  capabilities: null,
  capabilitiesLoading: false,

  detectCapabilities: async () => {
    set({ capabilitiesLoading: true });
    const capabilities = await detectCapabilities();
    set({ capabilities, capabilitiesLoading: false });
  },

  loadModel: async () => {
    await loadModelManager();
  },

  unloadModel: async () => {
    await unloadModelManager();
  },

  initSubscription: () => {
    const sync = () => {
      const s = getModelManagerState();
      set({
        status: s.status,
        modelName: s.activeTarget?.modelName ?? STEP_TARGET.modelName,
        quantization: s.activeTarget?.quantization ?? STEP_TARGET.quantization,
        contextWindow: s.activeTarget?.contextWindow ?? STEP_TARGET.contextWindow,
        loadTimeMs: s.loadTimeMs,
        error: s.error,
        runtimeConnected: s.runtimeConnected,
        diagnostics: s.diagnostics,
      });
    };
    sync();
    return subscribeModelManager(sync);
  },
}));
