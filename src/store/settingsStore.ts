import { create } from 'zustand';
import type { Settings } from '../lib/types';
import { getDefaultModelId } from '../ai/modelProfiles';

interface SettingsState extends Settings {
  sidebarOpen: boolean;
  settingsPanelOpen: boolean;
  toggleSidebar: () => void;
  toggleSettingsPanel: () => void;
  toggleDebugPanel: () => void;
  setMaxContextTokens: (n: number) => void;
  setModelId: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'light',
  showDebugPanel: false,
  maxContextTokens: 2048,
  modelId: getDefaultModelId(),
  sidebarOpen: false,
  settingsPanelOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSettingsPanel: () => set((s) => ({ settingsPanelOpen: !s.settingsPanelOpen })),
  toggleDebugPanel: () => set((s) => ({ showDebugPanel: !s.showDebugPanel })),
  setMaxContextTokens: (n) => set({ maxContextTokens: n }),
  setModelId: (id) => set({ modelId: id }),
}));
