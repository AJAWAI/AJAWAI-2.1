import { X } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import { ALL_MODELS } from '../../ai/runtime/modelRegistry';
import styles from './SettingsPanel.module.css';

export function SettingsPanel() {
  const open = useSettingsStore((s) => s.settingsPanelOpen);
  const toggle = useSettingsStore((s) => s.toggleSettingsPanel);
  const orch = useModelStore((s) => s.orch);

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
            <span className={styles.modelName}>{orch.activeModel?.displayName ?? 'Not connected'}</span>
            <span className={styles.modelMeta}>
              {orch.status === 'ready'
                ? `${orch.activeModel?.quantization} · ${orch.activeModel?.contextWindow} ctx · WebGPU`
                : 'Open debug panel to connect'}
            </span>
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Available Models</label>
          <div className={styles.configGrid}>
            {ALL_MODELS.map((m) => (
              <><span key={`${m.modelId}n`}>{m.displayName}</span><span key={`${m.modelId}v`}>{m.role} · {m.quantization} · {m.estimatedRAM_GB} GB</span></>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>Architecture</label>
          <div className={styles.configGrid}>
            <span>Runtime</span><span>Transformers.js + WebGPU</span>
            <span>Reasoning</span><span>Phi-3.5 Mini</span>
            <span>Vision</span><span>{orch.visionActive ? 'Moondream2 (active)' : 'Moondream2 (standby)'}</span>
            <span>Generation</span><span>Single-pass</span>
            <span>Selection</span><span>Automatic by device</span>
          </div>
        </div>
      </div>
    </div>
  );
}
