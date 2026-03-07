import { Activity, Cpu, HardDrive, Zap, Loader, WifiOff } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import { useChatStore } from '../../store/chatStore';
import { STEP_MODEL } from '../../ai/modelProfiles';
import styles from './DebugPanel.module.css';

const STATUS_DISPLAY: Record<string, string> = {
  'not-loaded': 'Not Loaded',
  'runtime-unavailable': 'Runtime Not Connected',
  'loading': 'Loading STEP…',
  'ready': 'STEP Ready',
  'generating': 'Generating…',
  'error': 'Error',
};

export function DebugPanel() {
  const show = useSettingsStore((s) => s.showDebugPanel);
  const capabilities = useModelStore((s) => s.capabilities);
  const capLoading = useModelStore((s) => s.capabilitiesLoading);
  const modelStatus = useModelStore((s) => s.status);
  const loadTimeMs = useModelStore((s) => s.loadTimeMs);
  const runtimeConnected = useModelStore((s) => s.runtimeConnected);
  const error = useModelStore((s) => s.error);
  const loadModel = useModelStore((s) => s.loadModel);
  const unloadModel = useModelStore((s) => s.unloadModel);
  const metrics = useChatStore((s) => s.lastMetrics);

  if (!show) return null;

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>
        <Activity size={14} /> Debug Panel
      </h3>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>
          <Cpu size={12} /> Device Capabilities
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
            <span>SharedArrayBuffer</span>
            <span className={capabilities.sharedArrayBuffer ? styles.good : styles.muted}>
              {capabilities.sharedArrayBuffer ? 'Yes' : 'No'}
            </span>
            <span>Memory</span>
            <span>{capabilities.deviceMemory ? `${capabilities.deviceMemory} GB` : 'N/A'}</span>
            <span>Cores</span>
            <span>{capabilities.hardwareConcurrency}</span>
            {capabilities.gpu && (
              <>
                <span>GPU</span>
                <span>{capabilities.gpu}</span>
              </>
            )}
          </div>
        ) : (
          <p className={styles.muted}>Not detected</p>
        )}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>
          <HardDrive size={12} /> STEP-3-VL-10B
        </h4>
        <div className={styles.grid}>
          <span>Model</span>
          <span>{STEP_MODEL.name}</span>
          <span>Size</span>
          <span>{(STEP_MODEL.sizeBytes / 1e9).toFixed(1)} GB</span>
          <span>Status</span>
          <span data-status={modelStatus} className={styles.statusBadge}>
            {modelStatus === 'loading' && <Loader size={10} className={styles.spin} />}
            {STATUS_DISPLAY[modelStatus] ?? modelStatus}
          </span>
          <span>Runtime</span>
          <span className={runtimeConnected ? styles.good : styles.warn}>
            {runtimeConnected ? (
              'Connected'
            ) : (
              <><WifiOff size={10} /> Not Connected</>
            )}
          </span>
          {loadTimeMs != null && (
            <>
              <span>Load Time</span>
              <span>{loadTimeMs.toFixed(0)} ms</span>
            </>
          )}
          {error && (
            <>
              <span>Error</span>
              <span className={styles.errorText}>{error}</span>
            </>
          )}
        </div>
        <div className={styles.actions}>
          {modelStatus === 'not-loaded' && (
            <button className={styles.actionBtn} onClick={() => loadModel()}>
              Connect STEP Runtime
            </button>
          )}
          {modelStatus === 'runtime-unavailable' && (
            <button className={styles.actionBtn} onClick={() => loadModel()}>
              Retry Connection
            </button>
          )}
          {(modelStatus === 'ready' || modelStatus === 'runtime-unavailable') && (
            <button className={styles.actionBtnSecondary} onClick={unloadModel}>
              Disconnect
            </button>
          )}
        </div>
      </div>

      {metrics && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <Zap size={12} /> Last Generation
          </h4>
          <div className={styles.grid}>
            <span>Source</span>
            <span className={metrics.generationSource === 'step' ? styles.good : styles.warn}>
              {metrics.generationSource === 'step' ? 'STEP-3-VL-10B' : 'Unavailable'}
            </span>
            <span>Prompt Size</span>
            <span>~{metrics.promptTokens} tokens</span>
            <span>Generation</span>
            <span>{metrics.generationLatencyMs?.toFixed(0) ?? '–'} ms</span>
            <span>Memory Retrieval</span>
            <span>{metrics.memoryRetrievalMs?.toFixed(0) ?? '–'} ms</span>
            <span>Total</span>
            <span>{metrics.totalLatencyMs?.toFixed(0) ?? '–'} ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
