import { create } from 'zustand';
import type { DeviceCapabilities, ModelStatus } from '../lib/types';
import { detectCapabilities } from '../ai/capabilityDetect';
import {
  loadModel as loadModelManager,
  unloadModel as unloadModelManager,
  getModelManagerState,
  subscribeModelManager,
} from '../ai/modelManager';
import { getDefaultModelId } from '../ai/modelProfiles';

interface ModelState {
  status: ModelStatus;
  modelName: string | null;
  loadTimeMs: number | null;
  error: string | null;
  capabilities: DeviceCapabilities | null;
  capabilitiesLoading: boolean;

  detectCapabilities: () => Promise<void>;
  loadModel: (modelId?: string) => Promise<void>;
  unloadModel: () => void;
  initSubscription: () => () => void;
}

export const useModelStore = create<ModelState>((set) => ({
  status: 'not-loaded',
  modelName: null,
  loadTimeMs: null,
  error: null,
  capabilities: null,
  capabilitiesLoading: false,

  detectCapabilities: async () => {
    set({ capabilitiesLoading: true });
    const capabilities = await detectCapabilities();
    set({ capabilities, capabilitiesLoading: false });
  },

  loadModel: async (modelId?: string) => {
    const id = modelId ?? getDefaultModelId();
    await loadModelManager(id);
  },

  unloadModel: () => {
    unloadModelManager();
  },

  initSubscription: () => {
    const sync = () => {
      const s = getModelManagerState();
      set({
        status: s.status,
        modelName: s.activeModel?.name ?? null,
        loadTimeMs: s.loadTimeMs,
        error: s.error,
      });
    };
    sync();
    return subscribeModelManager(sync);
  },
}));
