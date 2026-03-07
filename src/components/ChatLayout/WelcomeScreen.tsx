import { Bot, Sparkles, Shield, Zap } from 'lucide-react';
import { useModelStore } from '../../store/modelStore';
import { STEP_TARGET, getArtifactStatus } from '../../ai/modelProfiles';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  const runtimeConnected = useModelStore((s) => s.runtimeConnected);
  const modelStatus = useModelStore((s) => s.status);

  const artifactStatus = getArtifactStatus(STEP_TARGET.artifacts, STEP_TARGET.preferredRuntime);
  const artifactsMissing = artifactStatus === 'not-configured' || artifactStatus === 'invalid';

  return (
    <div className={styles.container}>
      <div className={styles.icon}>
        <Bot size={40} />
      </div>
      <h1 className={styles.title}>AJAWAI 2.1</h1>
      <p className={styles.subtitle}>
        {STEP_TARGET.modelName} · {STEP_TARGET.quantization} · {STEP_TARGET.contextWindow} ctx
      </p>

      {artifactsMissing && (
        <p className={styles.runtimeNotice}>
          Blocked: {STEP_TARGET.modelName} model files are not publicly available yet.
          <br />
          The app is ready — waiting for MLC-compiled artifacts.
        </p>
      )}

      {!artifactsMissing && !runtimeConnected && modelStatus !== 'loading' && (
        <p className={styles.runtimeNotice}>
          {STEP_TARGET.modelName} runtime is not connected.
          <br />
          Open the debug panel to attempt connection.
        </p>
      )}

      <div className={styles.features}>
        <div className={styles.feature}>
          <Zap size={18} className={styles.featureIcon} />
          <div>
            <strong>Q4 Optimized</strong>
            <p>~{STEP_TARGET.estimatedWeightSizeGB} GB, tuned for mobile</p>
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
