import { Bot, Sparkles, Shield, Zap } from 'lucide-react';
import { useModelStore } from '../../store/modelStore';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  const runtimeConnected = useModelStore((s) => s.runtimeConnected);
  const modelStatus = useModelStore((s) => s.status);

  return (
    <div className={styles.container}>
      <div className={styles.icon}>
        <Bot size={40} />
      </div>
      <h1 className={styles.title}>AJAWAI 2.1</h1>
      <p className={styles.subtitle}>Powered by STEP-3-VL-10B</p>

      {!runtimeConnected && modelStatus !== 'loading' && (
        <p className={styles.runtimeNotice}>
          STEP-3-VL-10B runtime is not connected yet.
          <br />
          The browser adapter is under development.
        </p>
      )}

      <div className={styles.features}>
        <div className={styles.feature}>
          <Zap size={18} className={styles.featureIcon} />
          <div>
            <strong>Fast & Lightweight</strong>
            <p>Optimized for mobile devices</p>
          </div>
        </div>
        <div className={styles.feature}>
          <Shield size={18} className={styles.featureIcon} />
          <div>
            <strong>Private & Local</strong>
            <p>Runs entirely on your device</p>
          </div>
        </div>
        <div className={styles.feature}>
          <Sparkles size={18} className={styles.featureIcon} />
          <div>
            <strong>Smart Memory</strong>
            <p>Remembers context across chats</p>
          </div>
        </div>
      </div>

      <p className={styles.hint}>Type a message below to get started</p>
    </div>
  );
}
