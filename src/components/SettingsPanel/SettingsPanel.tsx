import { X } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import { MODEL_PROFILES } from '../../ai/modelProfiles';
import styles from './SettingsPanel.module.css';

export function SettingsPanel() {
  const open = useSettingsStore((s) => s.settingsPanelOpen);
  const toggle = useSettingsStore((s) => s.toggleSettingsPanel);
  const modelName = useModelStore((s) => s.modelName);
  const quantization = useModelStore((s) => s.quantization);
  const contextWindow = useModelStore((s) => s.contextWindow);
  const runtimeConnected = useModelStore((s) => s.runtimeConnected);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={toggle}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button className={styles.closeBtn} onClick={toggle} aria-label="Close"><X size={18} /></button>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Active Model</label>
          <div className={styles.modelLocked}>
            <span className={styles.modelName}>{modelName}</span>
            <span className={styles.modelMeta}>
              {runtimeConnected
                ? `${quantization} · ${contextWindow} ctx · Ready`
                : 'Not connected — tap Connect in debug panel'}
            </span>
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Available Models</label>
          <div className={styles.configGrid}>
            {(['high', 'medium', 'low'] as const).map((t) => {
              const p = MODEL_PROFILES[t];
              return (
                <><span key={`${t}n`}>{p.displayName}</span><span key={`${t}v`}>{p.quantization} · {(p.fileSizeBytes / 1e9).toFixed(1)} GB · {p.contextWindow} ctx</span></>
              );
            })}
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Architecture</label>
          <div className={styles.configGrid}>
            <span>Runtime</span><span>Wllama (WASM)</span>
            <span>Memory</span><span>Memory-first</span>
            <span>Generation</span><span>Single-pass</span>
            <span>Selection</span><span>Automatic by device</span>
          </div>
        </div>
      </div>
    </div>
  );
}
