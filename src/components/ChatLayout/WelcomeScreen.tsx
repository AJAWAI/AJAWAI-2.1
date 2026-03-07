import { Bot, Sparkles, Shield, Zap } from 'lucide-react';
import { useModelStore } from '../../store/modelStore';
import { STEP_TARGET } from '../../ai/modelProfiles';
import { STEP_GGUF_ARTIFACTS, DEFAULT_GGUF_VARIANT } from '../../ai/ggufArtifacts';
import { useSettingsStore } from '../../store/settingsStore';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  const runtimeConnected = useModelStore((s) => s.runtimeConnected);
  const modelStatus = useModelStore((s) => s.status);
  const selectedRuntime = useSettingsStore((s) => s.selectedRuntime);

  const ggufCfg = STEP_GGUF_ARTIFACTS[DEFAULT_GGUF_VARIANT];
  const sizeLabel = selectedRuntime === 'wllama' && ggufCfg
    ? `${ggufCfg.quantization} · ${(ggufCfg.fileSizeBytes / 1e9).toFixed(1)} GB`
    : `~${STEP_TARGET.estimatedWeightSizeGB} GB`;

  return (
    <div className={styles.container}>
      <div className={styles.icon}>
        <Bot size={40} />
      </div>
      <h1 className={styles.title}>AJAWAI 2.1</h1>
      <p className={styles.subtitle}>
        {STEP_TARGET.modelName} · {sizeLabel} · {STEP_TARGET.contextWindow} ctx
      </p>

      {!runtimeConnected && modelStatus !== 'loading' && (
        <p className={styles.runtimeNotice}>
          Open the debug panel to connect {STEP_TARGET.modelName} via {selectedRuntime}.
        </p>
      )}

      <div className={styles.features}>
        <div className={styles.feature}>
          <Zap size={18} className={styles.featureIcon} />
          <div>
            <strong>{selectedRuntime === 'wllama' ? (ggufCfg?.quantization ?? 'GGUF') : 'Q4'} Optimized</strong>
            <p>{sizeLabel}, tuned for mobile</p>
          </div>
        </div>
        <div className={styles.feature}>
          <Shield size={18} className={styles.featureIcon} />
          <div>
            <strong>Private & Local</strong>
            <p>Single-pass generation, no remote calls</p>
          </div>
        </div>
        <div className={styles.feature}>
          <Sparkles size={18} className={styles.featureIcon} />
          <div>
            <strong>Memory-First</strong>
            <p>Smart retrieval compensates for compact context</p>
          </div>
        </div>
      </div>

      <p className={styles.hint}>Type a message below to get started</p>
    </div>
  );
}
