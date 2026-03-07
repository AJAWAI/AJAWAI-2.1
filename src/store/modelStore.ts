import { create } from 'zustand';
import type { DeviceCapabilities, ModelStatus } from '../lib/types';
import { detectCapabilities } from '../ai/capabilityDetect';
import {
  loadModel as loadModelManager,
  unloadModel as unloadModelManager,
  getModelManagerState,
  subscribeModelManager,
} from '../ai/modelManager';
import { STEP_MODEL } from '../ai/modelProfiles';

interface ModelState {
  status: ModelStatus;
  modelName: string;
  loadTimeMs: number | null;
  error: string | null;
  runtimeConnected: boolean;
  capabilities: DeviceCapabilities | null;
  capabilitiesLoading: boolean;

  detectCapabilities: () => Promise<void>;
  loadModel: () => Promise<void>;
  unloadModel: () => void;
  initSubscription: () => () => void;
}

export const useModelStore = create<ModelState>((set) => ({
  status: 'not-loaded',
  modelName: STEP_MODEL.name,
  loadTimeMs: null,
  error: null,
  runtimeConnected: false,
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

  unloadModel: () => {
    unloadModelManager();
  },

  initSubscription: () => {
    const sync = () => {
      const s = getModelManagerState();
      set({
        status: s.status,
        modelName: s.activeModel?.name ?? STEP_MODEL.name,
        loadTimeMs: s.loadTimeMs,
        error: s.error,
        runtimeConnected: s.runtimeConnected,
      });
    };
    sync();
    return subscribeModelManager(sync);
  },
}));
