import { create } from 'zustand';

interface SettingsState {
  showDebugPanel: boolean;
  sidebarOpen: boolean;
  settingsPanelOpen: boolean;
  toggleSidebar: () => void;
  toggleSettingsPanel: () => void;
  toggleDebugPanel: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  showDebugPanel: false,
  sidebarOpen: false,
  settingsPanelOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSettingsPanel: () => set((s) => ({ settingsPanelOpen: !s.settingsPanelOpen })),
  toggleDebugPanel: () => set((s) => ({ showDebugPanel: !s.showDebugPanel })),
}));
