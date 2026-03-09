import { Menu, Settings, Bug } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import styles from './Header.module.css';

export function Header() {
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const toggleSettingsPanel = useSettingsStore((s) => s.toggleSettingsPanel);
  const toggleDebugPanel = useSettingsStore((s) => s.toggleDebugPanel);
  const orch = useModelStore((s) => s.orch);

  let badge: string;
  if (orch.status === 'ready') badge = orch.activeModel?.displayName ?? 'Ready';
  else if (orch.status === 'loading' || orch.status === 'switching') {
    const p = orch.loader.combinedProgress;
    badge = p > 0 && p < 1 ? `${(p * 100).toFixed(0)}%` : 'Loading…';
  }
  else if (orch.status === 'error') badge = 'Error';
  else badge = 'Not Connected';

  const dataStatus = orch.status === 'ready' ? 'ready' : orch.status === 'loading' || orch.status === 'switching' ? 'loading' : orch.status === 'error' ? 'error' : 'not-loaded';

  return (
    <header className={styles.header}>
      <button className={styles.iconBtn} onClick={toggleSidebar} aria-label="Menu"><Menu size={20} /></button>
      <div className={styles.center}>
        <span className={styles.title}>AJAWAI</span>
        <span className={styles.badge} data-status={dataStatus}>{badge}</span>
      </div>
      <div className={styles.actions}>
        <button className={styles.iconBtn} onClick={toggleDebugPanel} aria-label="Debug"><Bug size={18} /></button>
        <button className={styles.iconBtn} onClick={toggleSettingsPanel} aria-label="Settings"><Settings size={18} /></button>
      </div>
    </header>
  );
}
