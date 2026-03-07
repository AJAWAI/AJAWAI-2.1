import { Activity, Cpu, HardDrive, Loader, Brain, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import { useChatStore } from '../../store/chatStore';
import { STEP_TARGET } from '../../ai/modelProfiles';
import { STEP_GGUF_ARTIFACTS, DEFAULT_GGUF_VARIANT } from '../../ai/ggufArtifacts';
import type { RuntimeId } from '../../ai/runtimeTypes';
import styles from './DebugPanel.module.css';

const STAGE_LABELS: Record<string, string> = {
  'idle': 'Idle',
  'checking-browser': 'Checking browser',
  'checking-artifacts': 'Checking artifacts',
  'checking-memory': 'Checking memory',
  'loading-runtime': 'Loading WASM runtime',
  'downloading-model': 'Downloading model',
  'loading-model': 'Loading into memory',
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

  const isIdle = modelStatus === 'not-loaded' || modelStatus === 'error';
  const isLoading = modelStatus === 'loading';
  const d = diagnostics;
  const hasDiag = d.stage !== 'idle';
  const ggufCfg = STEP_GGUF_ARTIFACTS[DEFAULT_GGUF_VARIANT];
  const wllamaDiag = d as unknown as Record<string, unknown>;

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>
        <Activity size={14} /> Debug
      </h3>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}><Cpu size={12} /> Device</h4>
        {capLoading ? (
          <p className={styles.muted}>Detecting…</p>
        ) : capabilities ? (
          <div className={styles.grid}>
            <span>WebGPU</span><span className={capabilities.webgpu ? styles.good : styles.muted}>{capabilities.webgpu ? 'Yes' : 'No'}</span>
            <span>WASM</span><span className={capabilities.wasm ? styles.good : styles.muted}>{capabilities.wasm ? 'Yes' : 'No'}</span>
            <span>Memory</span><span>{capabilities.deviceMemory ? `${capabilities.deviceMemory} GB` : 'N/A'}</span>
            <span>Cores</span><span>{capabilities.hardwareConcurrency}</span>
          </div>
        ) : <p className={styles.muted}>Not detected</p>}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}><HardDrive size={12} /> Runtime</h4>
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
          <span>Model</span><span>{STEP_TARGET.modelName}</span>
          <span>Runtime</span><span className={styles.good}>{selectedRuntime}</span>
          {selectedRuntime === 'wllama' && ggufCfg && (
            <>
              <span>GGUF</span><span>{ggufCfg.quantization} ({ggufCfg.fileMode})</span>
              <span>File</span><span>{(ggufCfg.fileSizeBytes / 1e9).toFixed(2)} GB</span>
              <span>Est. RAM</span><span>~{ggufCfg.estimatedRuntimeGB} GB</span>
            </>
          )}
          <span>Context</span><span>{STEP_TARGET.contextWindow} tokens</span>
        </div>

        {isLoading && d.subStatus && (
          <div className={styles.liveStatus}>
            <Loader size={12} className={styles.spin} />
            <span>{d.subStatus}</span>
          </div>
        )}

        {isLoading && d.downloadProgress > 0 && d.downloadProgress < 1 && (
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${(d.downloadProgress * 100).toFixed(1)}%` }} />
          </div>
        )}

        {isLoading && d.elapsedMs > 0 && (
          <p className={styles.muted} style={{ marginTop: 4, fontSize: 10 }}>
            Elapsed: {(d.elapsedMs / 1000).toFixed(1)}s
            {d.downloadedBytes > 0 && ` · ${(d.downloadedBytes / 1e6).toFixed(0)} MB downloaded`}
          </p>
        )}

        <div className={styles.grid} style={{ marginTop: 6 }}>
          <span>Status</span>
          <span data-status={modelStatus} className={styles.statusBadge}>
            {isLoading && <Loader size={10} className={styles.spin} />}
            {runtimeConnected ? 'STEP Ready' : isLoading ? (STAGE_LABELS[d.stage] ?? d.stage) : modelStatus === 'error' ? 'Error' : 'Not Loaded'}
          </span>
          {loadTimeMs != null && (
            <><span>Load Time</span><span>{(loadTimeMs / 1000).toFixed(1)}s</span></>
          )}
        </div>

        <div className={styles.actions}>
          {isIdle && (
            <button className={styles.actionBtn} onClick={() => loadModel()}>
              {modelStatus === 'error' ? 'Retry' : 'Connect STEP'}
            </button>
          )}
          {modelStatus === 'error' && (
            <button className={styles.actionBtnSecondary} onClick={unloadModel} style={{ marginLeft: 8 }}>
              Reset
            </button>
          )}
          {runtimeConnected && (
            <button className={styles.actionBtnSecondary} onClick={unloadModel}>
              Disconnect
            </button>
          )}
        </div>
      </div>

      {hasDiag && d.stage !== 'ready' && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}><AlertTriangle size={12} /> Diagnostics</h4>
          <div className={styles.grid}>
            <span>Stage</span>
            <span className={d.stage === 'failed' ? styles.errorText : undefined}>
              {STAGE_LABELS[d.stage] ?? d.stage}
            </span>
            <span>Browser</span>
            <span className={d.browserCompatible === false ? styles.errorText : d.browserCompatible ? styles.good : styles.muted}>
              {d.browserCompatible === null ? '—' : d.browserCompatible ? 'OK' : 'Unsupported'}
            </span>
            <span>Artifacts</span>
            <span className={d.artifactsAvailable === false ? styles.errorText : d.artifactsAvailable ? styles.good : styles.muted}>
              {d.artifactsAvailable === null ? '—' : d.artifactsAvailable ? 'OK' : 'Missing'}
            </span>
            <span>RAM</span>
            <span className={d.memorySufficient === false ? styles.errorText : d.memorySufficient ? styles.good : styles.muted}>
              {d.memorySufficient === null ? (d.memoryEstimateGB ? `${d.memoryEstimateGB} GB` : '—') : d.memorySufficient ? `${d.memoryEstimateGB ?? '?'} GB OK` : 'Low'}
            </span>
            {(wllamaDiag['quotaAvailableGB'] as number | null) !== null && (
              <>
                <span>Storage</span>
                <span>{(wllamaDiag['quotaAvailableGB'] as number).toFixed(1)} GB free / {(wllamaDiag['quotaTotalGB'] as number)?.toFixed(1) ?? '?'} GB</span>
              </>
            )}
            {Boolean(wllamaDiag['installedLocally']) && (
              <>
                <span>Cache</span>
                <span className={styles.good}>Installed ({String(wllamaDiag['storageBackend'])})</span>
              </>
            )}
            {wllamaDiag['loadSource'] !== undefined && wllamaDiag['loadSource'] !== 'unknown' && (
              <>
                <span>Source</span>
                <span>{wllamaDiag['loadSource'] === 'cache' ? 'Local cache' : 'Network download'}</span>
              </>
            )}
          </div>

          {Array.isArray(wllamaDiag['artifactChecks']) && (wllamaDiag['artifactChecks'] as Array<{label: string; reachable: boolean; error: string | null; contentLength: number | null}>).length > 0 && (
            <>
              <h4 className={styles.sectionTitle} style={{ marginTop: 6 }}>Artifacts</h4>
              {(wllamaDiag['artifactChecks'] as Array<{label: string; reachable: boolean; error: string | null; contentLength: number | null}>).map((c, i) => (
                <div key={i} className={styles.artifactRow}>
                  <span className={c.reachable ? styles.good : styles.errorText}>
                    {c.reachable ? '✓' : '✗'}
                  </span>{' '}{c.label}
                  {c.contentLength ? ` (${(c.contentLength / 1e9).toFixed(2)} GB)` : ''}
                  {!c.reachable && c.error ? ` — ${c.error}` : ''}
                </div>
              ))}
              {wllamaDiag['mmprojCheck'] && (
                <div className={styles.artifactRow}>
                  <span className={(wllamaDiag['mmprojCheck'] as {reachable: boolean}).reachable ? styles.good : styles.muted}>
                    {(wllamaDiag['mmprojCheck'] as {reachable: boolean}).reachable ? '✓' : '—'}
                  </span>{' '}mmproj (optional)
                </div>
              )}
            </>
          )}

          {error && (
            <p className={styles.failureBox}>
              <strong>Failed at: {d.failureStage ? (STAGE_LABELS[d.failureStage] ?? d.failureStage) : 'unknown'}</strong>
              {d.elapsedMs > 0 && ` (${(d.elapsedMs / 1000).toFixed(1)}s)`}
              <br />{error}
            </p>
          )}
        </div>
      )}

      {metrics && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}><Brain size={12} /> Last Generation</h4>
          <div className={styles.grid}>
            <span>Source</span>
            <span className={metrics.generationSource === 'step' ? styles.good : styles.warn}>
              {metrics.generationSource === 'step' ? 'STEP-3-VL-10B' : 'Unavailable'}
            </span>
            <span>Mode</span><span>Single-pass</span>
            <span>Memory</span><span>{metrics.memoryItemsInjected} items</span>
            <span>Latency</span><span>{metrics.totalLatencyMs?.toFixed(0) ?? '–'} ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
