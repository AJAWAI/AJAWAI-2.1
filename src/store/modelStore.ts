import { create } from 'zustand';
import type { DeviceCapabilities } from '../lib/types';
import { detectCapabilities } from '../ai/capabilityDetect';
import {
  connect,
  disconnect,
  getOrchestratorState,
  subscribeOrchestrator,
  type OrchestratorState,
} from '../ai/runtime/modelOrchestrator';

interface ModelState {
  orch: OrchestratorState;
  capabilities: DeviceCapabilities | null;
  capabilitiesLoading: boolean;

  detectCapabilities: () => Promise<void>;
  loadModel: (safeMode?: boolean) => Promise<void>;
  unloadModel: () => Promise<void>;
  initSubscription: () => () => void;
}

export const useModelStore = create<ModelState>((set) => ({
  orch: getOrchestratorState(),
  capabilities: null,
  capabilitiesLoading: false,

  detectCapabilities: async () => {
    set({ capabilitiesLoading: true });
    const capabilities = await detectCapabilities();
    set({ capabilities, capabilitiesLoading: false });
  },

  loadModel: async (safeMode?: boolean) => { await connect(safeMode); },
  unloadModel: async () => { await disconnect(); },

  initSubscription: () => {
    return subscribeOrchestrator((orch) => {
      set({ orch });
    });
  },
}));
