import { create } from 'zustand';

interface SettingsState {
  showDebugPanel: boolean;
  safeLoadMode: boolean;
  sidebarOpen: boolean;
  settingsPanelOpen: boolean;
  toggleSidebar: () => void;
  toggleSettingsPanel: () => void;
  toggleDebugPanel: () => void;
  toggleSafeLoadMode: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  showDebugPanel: false,
  safeLoadMode: true,
  sidebarOpen: false,
  settingsPanelOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSettingsPanel: () => set((s) => ({ settingsPanelOpen: !s.settingsPanelOpen })),
  toggleDebugPanel: () => set((s) => ({ showDebugPanel: !s.showDebugPanel })),
  toggleSafeLoadMode: () => set((s) => ({ safeLoadMode: !s.safeLoadMode })),
}));
