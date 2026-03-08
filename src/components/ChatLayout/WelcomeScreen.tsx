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
  const isWllama = selectedRuntime === 'wllama' && ggufCfg;
  const quantLabel = isWllama ? ggufCfg.quantization : STEP_TARGET.quantization;
  const sizeGB = isWllama ? (ggufCfg.fileSizeBytes / 1e9).toFixed(1) : STEP_TARGET.estimatedWeightSizeGB.toFixed(1);
  const ctx = isWllama ? ggufCfg.contextWindow : STEP_TARGET.contextWindow;

  return (
    <div className={styles.container}>
      <div className={styles.icon}>
        <Bot size={40} />
      </div>
      <h1 className={styles.title}>AJAWAI 2.1</h1>
      <p className={styles.subtitle}>
        {STEP_TARGET.modelName} · {quantLabel} · {sizeGB} GB · {ctx} ctx
      </p>

      {!runtimeConnected && modelStatus !== 'loading' && (
        <p className={styles.runtimeNotice}>
          Open the debug panel to connect via {selectedRuntime}.
        </p>
      )}

      <div className={styles.features}>
        <div className={styles.feature}>
          <Zap size={18} className={styles.featureIcon} />
          <div>
            <strong>{quantLabel} Mobile</strong>
            <p>{sizeGB} GB, {ctx}-token context</p>
          </div>
        </div>
        <div className={styles.feature}>
          <Shield size={18} className={styles.featureIcon} />
          <div>
            <strong>Private & Local</strong>
            <p>Single-pass, no remote calls</p>
          </div>
        </div>
        <div className={styles.feature}>
          <Sparkles size={18} className={styles.featureIcon} />
          <div>
            <strong>Memory-First</strong>
            <p>Smart retrieval for compact context</p>
          </div>
        </div>
      </div>

      <p className={styles.hint}>Type a message below to get started</p>
    </div>
  );
}
