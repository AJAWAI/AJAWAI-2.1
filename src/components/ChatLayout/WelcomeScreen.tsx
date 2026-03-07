import { Bot, Sparkles, Shield, Zap } from 'lucide-react';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  return (
    <div className={styles.container}>
      <div className={styles.icon}>
        <Bot size={40} />
      </div>
      <h1 className={styles.title}>AJAWAI 2.1</h1>
      <p className={styles.subtitle}>Your local AI assistant</p>

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
