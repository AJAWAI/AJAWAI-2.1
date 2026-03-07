import { create } from 'zustand';
import type { Settings } from '../lib/types';
import type { RuntimeId } from '../ai/runtimeTypes';
import { STEP_TARGET } from '../ai/modelProfiles';
import { setSelectedRuntimeId } from '../ai/browserLocalAdapter';

interface SettingsState extends Settings {
  selectedRuntime: RuntimeId;
  sidebarOpen: boolean;
  settingsPanelOpen: boolean;
  toggleSidebar: () => void;
  toggleSettingsPanel: () => void;
  toggleDebugPanel: () => void;
  setMaxContextTokens: (n: number) => void;
  setRuntime: (id: RuntimeId) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'light',
  showDebugPanel: false,
  maxContextTokens: STEP_TARGET.contextWindow,
  modelId: STEP_TARGET.id,
  selectedRuntime: 'wllama',
  sidebarOpen: false,
  settingsPanelOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSettingsPanel: () => set((s) => ({ settingsPanelOpen: !s.settingsPanelOpen })),
  toggleDebugPanel: () => set((s) => ({ showDebugPanel: !s.showDebugPanel })),
  setMaxContextTokens: (n) => set({ maxContextTokens: n }),
  setRuntime: (id) => {
    setSelectedRuntimeId(id);
    set({ selectedRuntime: id });
  },
}));
