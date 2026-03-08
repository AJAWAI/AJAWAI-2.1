import { Bot, Sparkles, Shield, Zap } from 'lucide-react';
import { useModelStore } from '../../store/modelStore';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  const orch = useModelStore((s) => s.orch);

  return (
    <div className={styles.container}>
      <div className={styles.icon}><Bot size={40} /></div>
      <h1 className={styles.title}>AJAWAI 2.1</h1>
      <p className={styles.subtitle}>Local AI assistant · WebGPU</p>

      {orch.status !== 'ready' && orch.status !== 'loading' && (
        <p className={styles.runtimeNotice}>
          Open the debug panel to connect a local model.
          <br />AJAWAI auto-selects the best model for your device.
        </p>
      )}

      <div className={styles.features}>
        <div className={styles.feature}>
          <Zap size={18} className={styles.featureIcon} />
          <div><strong>Adaptive</strong><p>Best model for your device, automatically</p></div>
        </div>
        <div className={styles.feature}>
          <Shield size={18} className={styles.featureIcon} />
          <div><strong>Private</strong><p>Runs entirely on your device via WebGPU</p></div>
        </div>
        <div className={styles.feature}>
          <Sparkles size={18} className={styles.featureIcon} />
          <div><strong>Multimodal</strong><p>Text + vision with automatic model switching</p></div>
        </div>
      </div>

      <p className={styles.hint}>Type a message below to get started</p>
    </div>
  );
}
