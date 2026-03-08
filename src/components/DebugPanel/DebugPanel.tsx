import { Activity, Cpu, HardDrive, Loader, Brain, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import { useChatStore } from '../../store/chatStore';
import { MODEL_PROFILES } from '../../ai/modelProfiles';
import styles from './DebugPanel.module.css';

const STAGE: Record<string, string> = {
  'idle': 'Idle', 'selecting-model': 'Selecting model', 'checking-browser': 'Checking browser',
  'checking-storage': 'Checking storage', 'checking-artifacts': 'Checking artifacts',
  'loading-runtime': 'Loading WASM', 'downloading-model': 'Downloading',
  'loading-model': 'Loading model', 'ready': 'Ready', 'failed': 'Failed',
};

export function DebugPanel() {
  const show = useSettingsStore((s) => s.showDebugPanel);
  const capabilities = useModelStore((s) => s.capabilities);
  const capLoading = useModelStore((s) => s.capabilitiesLoading);
  const status = useModelStore((s) => s.status);
  const modelName = useModelStore((s) => s.modelName);
  const quantization = useModelStore((s) => s.quantization);
  const contextWindow = useModelStore((s) => s.contextWindow);
  const loadTimeMs = useModelStore((s) => s.loadTimeMs);
  const runtimeConnected = useModelStore((s) => s.runtimeConnected);
  const error = useModelStore((s) => s.error);
  const d = useModelStore((s) => s.diagnostics);
  const fallbackTriggered = useModelStore((s) => s.fallbackTriggered);
  const fallbackReason = useModelStore((s) => s.fallbackReason);
  const selectionReason = useModelStore((s) => s.selectionReason);
  const loadModel = useModelStore((s) => s.loadModel);
  const unloadModel = useModelStore((s) => s.unloadModel);
  const metrics = useChatStore((s) => s.lastMetrics);

  if (!show) return null;

  const isIdle = status === 'not-loaded' || status === 'error';
  const isLoading = status === 'loading';

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}><Activity size={14} /> Debug</h3>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}><Cpu size={12} /> Device</h4>
        {capLoading ? <p className={styles.muted}>Detecting…</p> : capabilities ? (
          <div className={styles.grid}>
            <span>RAM</span><span>{capabilities.deviceMemory ? `${capabilities.deviceMemory} GB` : 'N/A'}</span>
            <span>Cores</span><span>{capabilities.hardwareConcurrency}</span>
            <span>WebGPU</span><span className={capabilities.webgpu ? styles.good : styles.muted}>{capabilities.webgpu ? 'Yes' : 'No'}</span>
            <span>WASM</span><span className={capabilities.wasm ? styles.good : styles.muted}>{capabilities.wasm ? 'Yes' : 'No'}</span>
            {selectionReason && <><span>Selection</span><span>{selectionReason}</span></>}
          </div>
        ) : <p className={styles.muted}>Not detected</p>}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}><HardDrive size={12} /> Model Tiers</h4>
        <div className={styles.grid}>
          {(['high', 'medium', 'low'] as const).map((t) => {
            const p = MODEL_PROFILES[t];
            const active = d.activeProfile?.tier === t;
            return (
              <span key={t} style={{ gridColumn: '1 / -1' }} className={active ? styles.good : styles.muted}>
                {active ? '▶ ' : '  '}{p.displayName} {p.quantization} ({(p.fileSizeBytes / 1e9).toFixed(1)} GB) ~{p.estimatedRuntimeGB} GB
              </span>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}><HardDrive size={12} /> Status</h4>
        <div className={styles.grid}>
          <span>Model</span><span className={runtimeConnected ? styles.good : undefined}>{modelName}</span>
          {quantization && <><span>Quant</span><span>{quantization}</span></>}
          <span>Context</span><span>{contextWindow}</span>
          <span>Status</span>
          <span data-status={status} className={styles.statusBadge}>
            {isLoading && <Loader size={10} className={styles.spin} />}
            {runtimeConnected ? 'Ready' : isLoading ? (STAGE[d.stage] ?? d.stage) : status === 'error' ? 'Error' : 'Not Loaded'}
          </span>
          {d.quotaAvailableGB !== null && <><span>Storage</span><span>{d.quotaAvailableGB.toFixed(1)} GB free</span></>}
          {d.loadSource !== 'unknown' && <><span>Source</span><span>{d.loadSource === 'cache' ? 'Local cache' : 'Network'}</span></>}
          {loadTimeMs != null && <><span>Load</span><span>{(loadTimeMs / 1000).toFixed(1)}s</span></>}
        </div>

        {isLoading && d.subStatus && (
          <div className={styles.liveStatus}><Loader size={12} className={styles.spin} /><span>{d.subStatus}</span></div>
        )}
        {isLoading && d.downloadProgress > 0 && d.downloadProgress < 1 && (
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${(d.downloadProgress * 100).toFixed(1)}%` }} />
          </div>
        )}

        {fallbackTriggered && (
          <p className={styles.warnBox}>
            <strong>Fallback triggered</strong><br />{fallbackReason}
          </p>
        )}

        <div className={styles.actions}>
          {isIdle && (
            <button className={styles.actionBtn} onClick={() => loadModel()}>
              {status === 'error' ? 'Retry' : 'Connect'}
            </button>
          )}
          {status === 'error' && (
            <button className={styles.actionBtnSecondary} onClick={unloadModel} style={{ marginLeft: 8 }}>Reset</button>
          )}
          {runtimeConnected && (
            <button className={styles.actionBtnSecondary} onClick={unloadModel}>Disconnect</button>
          )}
        </div>
      </div>

      {d.stage === 'failed' && error && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}><AlertTriangle size={12} /> Failure</h4>
          <div className={styles.grid}>
            <span>Stage</span><span className={styles.errorText}>{STAGE[d.failureStage ?? ''] ?? d.failureStage}</span>
            {d.failureCategory && <><span>Type</span><span>{d.failureCategory}</span></>}
            {d.elapsedMs > 0 && <><span>Elapsed</span><span>{(d.elapsedMs / 1000).toFixed(1)}s</span></>}
          </div>
          <p className={styles.failureBox}>{error}</p>
        </div>
      )}

      {metrics && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}><Brain size={12} /> Generation</h4>
          <div className={styles.grid}>
            <span>Source</span><span className={metrics.generationSource === 'step' ? styles.good : styles.warn}>{metrics.generationSource === 'step' ? modelName : 'Unavailable'}</span>
            <span>Latency</span><span>{metrics.totalLatencyMs?.toFixed(0) ?? '–'} ms</span>
            <span>Tokens</span><span>{metrics.promptTokens}</span>
          </div>
        </div>
      )}
    </div>
  );
}
