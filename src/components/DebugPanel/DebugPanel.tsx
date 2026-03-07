import { Activity, Cpu, HardDrive, Zap, Loader, WifiOff, Brain } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import { useChatStore } from '../../store/chatStore';
import { STEP_TARGET } from '../../ai/modelProfiles';
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
          <HardDrive size={12} /> Target Config
        </h4>
        <div className={styles.grid}>
          <span>Model</span>
          <span>{STEP_TARGET.modelName}</span>
          <span>Quantization</span>
          <span>{STEP_TARGET.quantization}</span>
          <span>Context</span>
          <span>{STEP_TARGET.contextWindow} tokens</span>
          <span>Max Output</span>
          <span>{STEP_TARGET.maxOutputTokens} tokens</span>
          <span>Weights</span>
          <span>~{STEP_TARGET.estimatedWeightSizeGB} GB</span>
          <span>Runtime RAM</span>
          <span>~{STEP_TARGET.estimatedRuntimeMemoryGB} GB</span>
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
            <Brain size={12} /> Last Generation
          </h4>
          <div className={styles.grid}>
            <span>Source</span>
            <span className={metrics.generationSource === 'step' ? styles.good : styles.warn}>
              {metrics.generationSource === 'step' ? 'STEP-3-VL-10B' : 'Unavailable'}
            </span>
            <span>Mode</span>
            <span>Single-pass{metrics.secondPassUsed ? ' + review' : ''}</span>
            <span>Memory Items</span>
            <span>{metrics.memoryItemsInjected}</span>
            <span>Recent Turns</span>
            <span>{metrics.recentTurnsIncluded}</span>
          </div>

          <h4 className={styles.sectionTitle} style={{ marginTop: 8 }}>
            <Zap size={12} /> Budget Usage ({metrics.budgetUsage.total}/{STEP_TARGET.contextWindow - STEP_TARGET.maxOutputTokens} tokens)
          </h4>
          <div className={styles.grid}>
            <span>System</span>
            <span>{metrics.budgetUsage.system}</span>
            <span>Memory</span>
            <span>{metrics.budgetUsage.memory}</span>
            <span>History</span>
            <span>{metrics.budgetUsage.history}</span>
            <span>Current Msg</span>
            <span>{metrics.budgetUsage.currentMessage}</span>
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
