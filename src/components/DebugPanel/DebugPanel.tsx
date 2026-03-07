import { Activity, Cpu, HardDrive, Zap, Loader, WifiOff, Brain, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import { useChatStore } from '../../store/chatStore';
import { STEP_TARGET } from '../../ai/modelProfiles';
import styles from './DebugPanel.module.css';

const STATUS_DISPLAY: Record<string, string> = {
  'not-loaded': 'Not Loaded',
  'runtime-unavailable': 'Runtime Not Connected',
  'loading': 'Connecting…',
  'ready': 'STEP Ready',
  'generating': 'Generating…',
  'error': 'Error',
};

const STAGE_DISPLAY: Record<string, string> = {
  'idle': 'Idle',
  'checking-browser': 'Checking browser…',
  'checking-artifacts': 'Checking model artifacts…',
  'checking-memory': 'Checking device memory…',
  'downloading': 'Downloading model…',
  'initializing': 'Initializing runtime…',
  'ready': 'Ready',
  'failed': 'Failed',
};

export function DebugPanel() {
  const show = useSettingsStore((s) => s.showDebugPanel);
  const capabilities = useModelStore((s) => s.capabilities);
  const capLoading = useModelStore((s) => s.capabilitiesLoading);
  const modelStatus = useModelStore((s) => s.status);
  const loadTimeMs = useModelStore((s) => s.loadTimeMs);
  const runtimeConnected = useModelStore((s) => s.runtimeConnected);
  const error = useModelStore((s) => s.error);
  const diagnostics = useModelStore((s) => s.diagnostics);
  const loadModel = useModelStore((s) => s.loadModel);
  const unloadModel = useModelStore((s) => s.unloadModel);
  const metrics = useChatStore((s) => s.lastMetrics);

  if (!show) return null;

  const hasDiag = diagnostics.stage !== 'idle';

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>
        <Activity size={14} /> Debug Panel
      </h3>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>
          <Cpu size={12} /> Device
        </h4>
        {capLoading ? (
          <p className={styles.muted}>Detecting…</p>
        ) : capabilities ? (
          <div className={styles.grid}>
            <span>WebGPU</span>
            <span className={capabilities.webgpu ? styles.good : styles.muted}>
              {capabilities.webgpu ? 'Yes' : 'No'}
            </span>
            <span>WASM</span>
            <span className={capabilities.wasm ? styles.good : styles.muted}>
              {capabilities.wasm ? 'Yes' : 'No'}
            </span>
            <span>Memory</span>
            <span>{capabilities.deviceMemory ? `${capabilities.deviceMemory} GB` : 'N/A'}</span>
            <span>Cores</span>
            <span>{capabilities.hardwareConcurrency}</span>
          </div>
        ) : (
          <p className={styles.muted}>Not detected</p>
        )}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>
          <HardDrive size={12} /> Target: {STEP_TARGET.modelName}
        </h4>
        <div className={styles.grid}>
          <span>Quantization</span>
          <span>{STEP_TARGET.quantization}</span>
          <span>Context</span>
          <span>{STEP_TARGET.contextWindow} tokens</span>
          <span>Weights</span>
          <span>~{STEP_TARGET.estimatedWeightSizeGB} GB</span>
          <span>Runtime</span>
          <span>{STEP_TARGET.preferredRuntime}</span>
          <span>Artifacts</span>
          <span className={STEP_TARGET.artifacts ? styles.good : styles.warn}>
            {STEP_TARGET.artifacts ? 'Configured' : 'Missing'}
          </span>
          <span>Status</span>
          <span data-status={modelStatus} className={styles.statusBadge}>
            {modelStatus === 'loading' && <Loader size={10} className={styles.spin} />}
            {STATUS_DISPLAY[modelStatus] ?? modelStatus}
          </span>
          <span>Connected</span>
          <span className={runtimeConnected ? styles.good : styles.warn}>
            {runtimeConnected ? (
              'Yes'
            ) : (
              <><WifiOff size={10} /> No</>
            )}
          </span>
          {loadTimeMs != null && (
            <>
              <span>Load Time</span>
              <span>{loadTimeMs.toFixed(0)} ms</span>
            </>
          )}
        </div>
        <div className={styles.actions}>
          {(modelStatus === 'not-loaded' || modelStatus === 'error') && (
            <button className={styles.actionBtn} onClick={() => loadModel()}>
              {modelStatus === 'error' ? 'Retry Connection' : 'Connect STEP'}
            </button>
          )}
          {modelStatus === 'loading' && (
            <span className={styles.muted}>
              <Loader size={12} className={styles.spin} /> Connecting…
            </span>
          )}
          {runtimeConnected && (
            <button className={styles.actionBtnSecondary} onClick={unloadModel}>
              Disconnect
            </button>
          )}
        </div>
      </div>

      {hasDiag && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <AlertTriangle size={12} /> Connection Diagnostics
          </h4>
          <div className={styles.grid}>
            <span>Runtime Path</span>
            <span>{diagnostics.runtimePath}</span>
            <span>Stage</span>
            <span className={diagnostics.stage === 'failed' ? styles.errorText : undefined}>
              {STAGE_DISPLAY[diagnostics.stage] ?? diagnostics.stage}
            </span>
            <span>Browser OK</span>
            <span className={diagnostics.browserCompatible === false ? styles.errorText : diagnostics.browserCompatible ? styles.good : styles.muted}>
              {diagnostics.browserCompatible === null ? '—' : diagnostics.browserCompatible ? 'Yes' : 'No'}
            </span>
            <span>Artifacts OK</span>
            <span className={diagnostics.artifactsAvailable === false ? styles.errorText : diagnostics.artifactsAvailable ? styles.good : styles.muted}>
              {diagnostics.artifactsAvailable === null ? '—' : diagnostics.artifactsAvailable ? 'Yes' : 'No'}
            </span>
            <span>Memory OK</span>
            <span className={diagnostics.memorySufficient === false ? styles.errorText : diagnostics.memorySufficient ? styles.good : styles.muted}>
              {diagnostics.memorySufficient === null ? '—' : diagnostics.memorySufficient ? 'Yes' : 'No'}
            </span>
            {diagnostics.memoryEstimateGB !== null && (
              <>
                <span>Device Mem</span>
                <span>{diagnostics.memoryEstimateGB} GB</span>
              </>
            )}
            {diagnostics.downloadProgress > 0 && diagnostics.downloadProgress < 1 && (
              <>
                <span>Download</span>
                <span>{(diagnostics.downloadProgress * 100).toFixed(0)}%</span>
              </>
            )}
          </div>
          {error && (
            <p className={styles.failureBox}>
              <strong>Failed at: {diagnostics.failureStage ?? 'unknown'}</strong><br />
              {error}
            </p>
          )}
        </div>
      )}

      {metrics && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <Brain size={12} /> Last Generation
          </h4>
          <div className={styles.grid}>
            <span>Source</span>
            <span className={metrics.generationSource === 'step' ? styles.good : styles.warn}>
              {metrics.generationSource === 'step' ? 'STEP-3-VL-10B' : 'Unavailable'}
            </span>
            <span>Mode</span>
            <span>Single-pass</span>
            <span>Memory Items</span>
            <span>{metrics.memoryItemsInjected}</span>
            <span>Recent Turns</span>
            <span>{metrics.recentTurnsIncluded}</span>
          </div>

          <h4 className={styles.sectionTitle} style={{ marginTop: 8 }}>
            <Zap size={12} /> Budget ({metrics.budgetUsage.total}/{STEP_TARGET.contextWindow - STEP_TARGET.maxOutputTokens})
          </h4>
          <div className={styles.grid}>
            <span>System</span>
            <span>{metrics.budgetUsage.system}</span>
            <span>Memory</span>
            <span>{metrics.budgetUsage.memory}</span>
            <span>History</span>
            <span>{metrics.budgetUsage.history}</span>
            <span>Current</span>
            <span>{metrics.budgetUsage.currentMessage}</span>
            <span>Latency</span>
            <span>{metrics.totalLatencyMs?.toFixed(0) ?? '–'} ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
