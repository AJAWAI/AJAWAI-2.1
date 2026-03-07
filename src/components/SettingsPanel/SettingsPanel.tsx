import { X } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { STEP_MODEL } from '../../ai/modelProfiles';
import styles from './SettingsPanel.module.css';

export function SettingsPanel() {
  const open = useSettingsStore((s) => s.settingsPanelOpen);
  const toggle = useSettingsStore((s) => s.toggleSettingsPanel);
  const maxTokens = useSettingsStore((s) => s.maxContextTokens);
  const setMaxTokens = useSettingsStore((s) => s.setMaxContextTokens);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={toggle}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button className={styles.closeBtn} onClick={toggle} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Model</label>
          <div className={styles.modelLocked}>
            <span className={styles.modelName}>{STEP_MODEL.name}</span>
            <span className={styles.modelMeta}>
              {(STEP_MODEL.sizeBytes / 1e9).toFixed(1)} GB — sole LLM for AJAWAI 2.1
            </span>
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Max Context Tokens</label>
          <input
            type="range"
            className={styles.range}
            min={512}
            max={4096}
            step={256}
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
          />
          <span className={styles.rangeValue}>{maxTokens}</span>
        </div>
      </div>
    </div>
  );
}
