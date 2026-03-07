import { Activity, Cpu, HardDrive, Loader, WifiOff, Brain, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import { useChatStore } from '../../store/chatStore';
import { STEP_TARGET } from '../../ai/modelProfiles';
import { STEP_GGUF_ARTIFACTS, DEFAULT_GGUF_VARIANT } from '../../ai/ggufArtifacts';
import type { RuntimeId } from '../../ai/runtimeTypes';
import styles from './DebugPanel.module.css';

const STATUS_DISPLAY: Record<string, string> = {
  'not-loaded': 'Not Loaded',
  'runtime-unavailable': 'Not Connected',
  'loading': 'Connecting…',
  'ready': 'STEP Ready',
  'generating': 'Generating…',
  'error': 'Error',
};

const STAGE_DISPLAY: Record<string, string> = {
  'idle': 'Idle',
  'checking-browser': 'Checking browser…',
  'checking-artifacts': 'Checking artifacts…',
  'checking-memory': 'Checking memory…',
  'downloading': 'Downloading model…',
  'initializing': 'Initializing…',
  'ready': 'Ready',
  'failed': 'Failed',
};

export function DebugPanel() {
  const show = useSettingsStore((s) => s.showDebugPanel);
  const selectedRuntime = useSettingsStore((s) => s.selectedRuntime);
  const setRuntime = useSettingsStore((s) => s.setRuntime);
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
  const isIdle = modelStatus === 'not-loaded' || modelStatus === 'error';
  const wllamaDiag = diagnostics as unknown as Record<string, unknown>;

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
          <HardDrive size={12} /> Runtime Selection
        </h4>
        <div className={styles.runtimePicker}>
          {(['webllm', 'wllama'] as RuntimeId[]).map((rt) => (
            <button
              key={rt}
              className={`${styles.runtimeBtn} ${selectedRuntime === rt ? styles.runtimeBtnActive : ''}`}
              onClick={() => { if (isIdle) setRuntime(rt); }}
              disabled={!isIdle}
            >
              {rt === 'webllm' ? 'WebLLM (WebGPU)' : 'Wllama (WASM)'}
            </button>
          ))}
        </div>

        <div className={styles.grid} style={{ marginTop: 8 }}>
          <span>Model</span>
          <span>{STEP_TARGET.modelName}</span>
          <span>Runtime</span>
          <span className={styles.good}>{selectedRuntime}</span>
          {selectedRuntime === 'wllama' && (() => {
            const cfg = STEP_GGUF_ARTIFACTS[DEFAULT_GGUF_VARIANT];
            return cfg ? (
              <>
                <span>GGUF</span>
                <span>{cfg.quantization} ({cfg.fileMode})</span>
                <span>File Size</span>
                <span>{(cfg.fileSizeBytes / 1e9).toFixed(2)} GB</span>
              </>
            ) : null;
          })()}
          <span>Context</span>
          <span>{STEP_TARGET.contextWindow} tokens</span>
          <span>Status</span>
          <span data-status={modelStatus} className={styles.statusBadge}>
            {modelStatus === 'loading' && <Loader size={10} className={styles.spin} />}
            {STATUS_DISPLAY[modelStatus] ?? modelStatus}
          </span>
          <span>Connected</span>
          <span className={runtimeConnected ? styles.good : styles.warn}>
            {runtimeConnected ? 'Yes' : <><WifiOff size={10} /> No</>}
          </span>
          {loadTimeMs != null && (
            <>
              <span>Load Time</span>
              <span>{(loadTimeMs / 1000).toFixed(1)} s</span>
            </>
          )}
        </div>

        <div className={styles.actions}>
          {isIdle && (
            <button className={styles.actionBtn} onClick={() => loadModel()}>
              {modelStatus === 'error' ? 'Retry' : 'Connect STEP'}
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
          {modelStatus === 'error' && (
            <button className={styles.actionBtnSecondary} onClick={unloadModel} style={{ marginLeft: 8 }}>
              Reset
            </button>
          )}
        </div>
      </div>

      {hasDiag && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <AlertTriangle size={12} /> Diagnostics
          </h4>
          <div className={styles.grid}>
            <span>Runtime</span>
            <span>{diagnostics.runtimePath}</span>
            <span>Stage</span>
            <span className={diagnostics.stage === 'failed' ? styles.errorText : undefined}>
              {STAGE_DISPLAY[diagnostics.stage] ?? diagnostics.stage}
            </span>
            <span>Browser</span>
            <span className={diagnostics.browserCompatible === false ? styles.errorText : diagnostics.browserCompatible ? styles.good : styles.muted}>
              {diagnostics.browserCompatible === null ? '—' : diagnostics.browserCompatible ? 'OK' : 'Unsupported'}
            </span>
            <span>Artifacts</span>
            <span className={diagnostics.artifactsAvailable === false ? styles.errorText : diagnostics.artifactsAvailable ? styles.good : styles.muted}>
              {diagnostics.artifactsAvailable === null ? '—' : diagnostics.artifactsAvailable ? 'OK' : 'Missing'}
            </span>
            <span>Memory</span>
            <span className={diagnostics.memorySufficient === false ? styles.errorText : diagnostics.memorySufficient ? styles.good : styles.muted}>
              {diagnostics.memorySufficient === null ? '—' : diagnostics.memorySufficient ? 'OK' : 'Low'}
            </span>
            {diagnostics.downloadProgress > 0 && diagnostics.downloadProgress < 1 && (
              <>
                <span>Download</span>
                <span>{(diagnostics.downloadProgress * 100).toFixed(0)}%</span>
              </>
            )}
          </div>

          {Array.isArray(wllamaDiag['artifactChecks']) && (wllamaDiag['artifactChecks'] as Array<{label: string; reachable: boolean; error: string | null; contentLength: number | null}>).length > 0 && (
            <>
              <h4 className={styles.sectionTitle} style={{ marginTop: 6 }}>Artifact Checks</h4>
              {(wllamaDiag['artifactChecks'] as Array<{label: string; reachable: boolean; error: string | null; contentLength: number | null}>).map((c, i) => (
                <div key={i} className={styles.artifactRow}>
                  <span className={c.reachable ? styles.good : styles.errorText}>
                    {c.reachable ? '✓' : '✗'}
                  </span>{' '}
                  {c.label}
                  {c.contentLength ? ` (${(c.contentLength / 1e9).toFixed(2)} GB)` : ''}
                  {!c.reachable && c.error ? ` — ${c.error}` : ''}
                </div>
              ))}
              {wllamaDiag['mmprojCheck'] && (
                <div className={styles.artifactRow}>
                  <span className={(wllamaDiag['mmprojCheck'] as {reachable: boolean}).reachable ? styles.good : styles.muted}>
                    {(wllamaDiag['mmprojCheck'] as {reachable: boolean}).reachable ? '✓' : '—'}
                  </span>{' '}
                  mmproj (optional for text)
                </div>
              )}
            </>
          )}

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
            <span>Memory</span>
            <span>{metrics.memoryItemsInjected} items</span>
            <span>Turns</span>
            <span>{metrics.recentTurnsIncluded}</span>
            <span>Latency</span>
            <span>{metrics.totalLatencyMs?.toFixed(0) ?? '–'} ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
