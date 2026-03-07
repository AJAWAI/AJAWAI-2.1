import { X } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { STEP_TARGET } from '../../ai/modelProfiles';
import styles from './SettingsPanel.module.css';

export function SettingsPanel() {
  const open = useSettingsStore((s) => s.settingsPanelOpen);
  const toggle = useSettingsStore((s) => s.toggleSettingsPanel);

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
            <span className={styles.modelName}>{STEP_TARGET.modelName}</span>
            <span className={styles.modelMeta}>
              {STEP_TARGET.quantization} · {STEP_TARGET.contextWindow} context · ~{STEP_TARGET.estimatedWeightSizeGB} GB
            </span>
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Architecture</label>
          <div className={styles.configGrid}>
            <span>Quantization</span><span>{STEP_TARGET.quantization}</span>
            <span>Context Window</span><span>{STEP_TARGET.contextWindow} tokens</span>
            <span>Max Output</span><span>{STEP_TARGET.maxOutputTokens} tokens</span>
            <span>Memory Mode</span><span>Memory-first</span>
            <span>Generation</span><span>Single-pass</span>
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Device Requirements</label>
          <div className={styles.configGrid}>
            <span>RAM</span><span>{STEP_TARGET.recommendedDeviceTier}</span>
            <span>Runtime</span><span>~{STEP_TARGET.estimatedRuntimeMemoryGB} GB</span>
            <span>Runtime</span><span>{STEP_TARGET.preferredRuntime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
