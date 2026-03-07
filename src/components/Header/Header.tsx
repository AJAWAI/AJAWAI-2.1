import { Menu, Settings, Bug } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import styles from './Header.module.css';

const STATUS_LABELS: Record<string, string> = {
  'ready': 'STEP Ready',
  'loading': 'Loading STEP…',
  'generating': 'Generating…',
  'runtime-unavailable': 'STEP Not Connected',
  'error': 'STEP Error',
  'not-loaded': 'STEP Not Loaded',
};

export function Header() {
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const toggleSettingsPanel = useSettingsStore((s) => s.toggleSettingsPanel);
  const toggleDebugPanel = useSettingsStore((s) => s.toggleDebugPanel);
  const modelStatus = useModelStore((s) => s.status);

  return (
    <header className={styles.header}>
      <button className={styles.iconBtn} onClick={toggleSidebar} aria-label="Toggle sidebar">
        <Menu size={20} />
      </button>

      <div className={styles.center}>
        <span className={styles.title}>AJAWAI</span>
        <span className={styles.badge} data-status={modelStatus}>
          {STATUS_LABELS[modelStatus] ?? modelStatus}
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
