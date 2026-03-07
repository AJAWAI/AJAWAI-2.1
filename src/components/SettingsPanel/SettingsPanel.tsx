import { X } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { MODEL_PROFILES } from '../../ai/modelProfiles';
import styles from './SettingsPanel.module.css';

export function SettingsPanel() {
  const open = useSettingsStore((s) => s.settingsPanelOpen);
  const toggle = useSettingsStore((s) => s.toggleSettingsPanel);
  const maxTokens = useSettingsStore((s) => s.maxContextTokens);
  const setMaxTokens = useSettingsStore((s) => s.setMaxContextTokens);
  const modelId = useSettingsStore((s) => s.modelId);
  const setModelId = useSettingsStore((s) => s.setModelId);

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
          <select
            className={styles.select}
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
          >
            {MODEL_PROFILES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({(m.sizeBytes / 1e9).toFixed(1)} GB)
              </option>
            ))}
          </select>
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
