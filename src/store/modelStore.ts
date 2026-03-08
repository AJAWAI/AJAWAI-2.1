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

interface ModelState {
  status: ModelStatus;
  modelName: string;
  quantization: string;
  contextWindow: number;
  loadTimeMs: number | null;
  error: string | null;
  runtimeConnected: boolean;
  diagnostics: ConnectionDiagnostics;
  fallbackTriggered: boolean;
  fallbackReason: string | null;
  selectionReason: string | null;
  capabilities: DeviceCapabilities | null;
  capabilitiesLoading: boolean;

  detectCapabilities: () => Promise<void>;
  loadModel: () => Promise<void>;
  unloadModel: () => Promise<void>;
  initSubscription: () => () => void;
}

export const useModelStore = create<ModelState>((set) => ({
  status: 'not-loaded',
  modelName: 'AJAWAI',
  quantization: '',
  contextWindow: 512,
  loadTimeMs: null,
  error: null,
  runtimeConnected: false,
  diagnostics: emptyDiagnostics('wllama'),
  fallbackTriggered: false,
  fallbackReason: null,
  selectionReason: null,
  capabilities: null,
  capabilitiesLoading: false,

  detectCapabilities: async () => {
    set({ capabilitiesLoading: true });
    const capabilities = await detectCapabilities();
    set({ capabilities, capabilitiesLoading: false });
  },

  loadModel: async () => { await loadModelManager(); },
  unloadModel: async () => { await unloadModelManager(); },

  initSubscription: () => {
    const sync = () => {
      const s = getModelManagerState();
      set({
        status: s.status,
        modelName: s.activeProfile?.displayName ?? 'AJAWAI',
        quantization: s.activeProfile?.quantization ?? '',
        contextWindow: s.activeProfile?.contextWindow ?? 512,
        loadTimeMs: s.loadTimeMs,
        error: s.error,
        runtimeConnected: s.runtimeConnected,
        diagnostics: s.diagnostics,
        fallbackTriggered: s.fallbackTriggered,
        fallbackReason: s.fallbackReason,
        selectionReason: s.selectionReason,
      });
    };
    sync();
    return subscribeModelManager(sync);
  },
}));
