import { Menu, Settings, Bug } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import styles from './Header.module.css';

const STAGE_SHORT: Record<string, string> = {
  'checking-browser': 'Checking…',
  'checking-artifacts': 'Checking…',
  'checking-memory': 'Checking…',
  'loading-runtime': 'Loading WASM…',
  'downloading-model': 'Downloading…',
  'loading-model': 'Loading model…',
};

export function Header() {
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const toggleSettingsPanel = useSettingsStore((s) => s.toggleSettingsPanel);
  const toggleDebugPanel = useSettingsStore((s) => s.toggleDebugPanel);
  const modelStatus = useModelStore((s) => s.status);
  const diagnostics = useModelStore((s) => s.diagnostics);

  let badgeText: string;
  if (modelStatus === 'ready') badgeText = 'STEP Ready';
  else if (modelStatus === 'loading') {
    const pct = diagnostics.downloadProgress;
    const stageLabel = STAGE_SHORT[diagnostics.stage] ?? 'Connecting…';
    badgeText = pct > 0 && pct < 1 ? `${(pct * 100).toFixed(0)}%` : stageLabel;
  }
  else if (modelStatus === 'error') badgeText = 'Error';
  else badgeText = 'STEP Not Loaded';

  return (
    <header className={styles.header}>
      <button className={styles.iconBtn} onClick={toggleSidebar} aria-label="Toggle sidebar">
        <Menu size={20} />
      </button>

      <div className={styles.center}>
        <span className={styles.title}>AJAWAI</span>
        <span className={styles.badge} data-status={modelStatus}>
          {badgeText}
        </span>
      </div>

      <div className={styles.actions}>
        <button className={styles.iconBtn} onClick={toggleDebugPanel} aria-label="Debug panel">
          <Bug size={18} />
        </button>
        <button className={styles.iconBtn} onClick={toggleSettingsPanel} aria-label="Settings">
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
