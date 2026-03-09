import { Activity, Cpu, HardDrive, Loader, Brain, AlertTriangle, Shield } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import { useChatStore } from '../../store/chatStore';
import { ALL_MODELS } from '../../ai/runtime/modelRegistry';
import { clearModelCache } from '../../ai/runtime/modelLoader';
import styles from './DebugPanel.module.css';

export function DebugPanel() {
  const show = useSettingsStore((s) => s.showDebugPanel);
  const safeLoadMode = useSettingsStore((s) => s.safeLoadMode);
  const toggleSafe = useSettingsStore((s) => s.toggleSafeLoadMode);
  const { orch, capabilities, capabilitiesLoading } = useModelStore();
  const loadModel = useModelStore((s) => s.loadModel);
  const unloadModel = useModelStore((s) => s.unloadModel);
  const metrics = useChatStore((s) => s.lastMetrics);

  if (!show) return null;

  const o = orch;
  const l = o.loader;
  const isIdle = o.status === 'idle' || o.status === 'error';
  const isLoading = o.status === 'loading' || o.status === 'switching' || o.status === 'detecting';

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}><Activity size={14} /> Debug</h3>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}><Cpu size={12} /> Device</h4>
        {capabilitiesLoading ? <p className={styles.muted}>Detecting…</p> : capabilities ? (
          <div className={styles.grid}>
            <span>RAM</span><span>{capabilities.deviceMemory ? `${capabilities.deviceMemory} GB` : 'N/A'}</span>
            <span>Cores</span><span>{capabilities.hardwareConcurrency}</span>
            <span>WebGPU</span><span className={capabilities.webgpu ? styles.good : styles.errorText}>{capabilities.webgpu ? 'Yes' : 'No'}</span>
            {o.tier && <><span>Tier</span><span className={styles.good}>{o.tier}</span></>}
          </div>
        ) : <p className={styles.muted}>Not detected</p>}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}><Shield size={12} /> Safe Load Mode</h4>
        <label className={styles.toggle}>
          <input type="checkbox" checked={safeLoadMode} onChange={toggleSafe} disabled={isLoading} />
          <span>{safeLoadMode ? 'ON — Phi only, extra delay, tiny smoke test' : 'OFF — normal loading'}</span>
        </label>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}><HardDrive size={12} /> Models</h4>
        {ALL_MODELS.map((m) => (
          <div key={m.modelId} className={styles.artifactRow}>
            <span className={o.activeModel?.modelId === m.modelId ? styles.good : styles.muted}>
              {o.activeModel?.modelId === m.modelId ? '▶ ' : '  '}{m.displayName}
            </span>{' '}
            <span className={styles.muted}>
              {m.quantization} · {m.estimatedRAM_GB}GB
              {m.browserReady
                ? <span className={styles.good}> · ready</span>
                : <span className={styles.errorText}> · unavailable</span>}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}><HardDrive size={12} /> Loader State</h4>
        <div className={styles.grid}>
          <span>Stage</span>
          <span data-status={o.status} className={styles.statusBadge}>
            {isLoading && <Loader size={10} className={styles.spin} />}
            {l.stage !== 'idle' ? l.stage : o.status}
          </span>
          <span>Last OK</span><span>{l.lastSuccessfulStage}</span>
          {l.loaderKind && <><span>Loader</span><span>{l.loaderKind}</span></>}
          {l.runtime && <><span>Runtime</span><span>{l.runtime}</span></>}
          {l.modelPackage && <><span>Package</span><span className={styles.muted}>{l.modelPackage}</span></>}
          <span>Browser gate</span><span className={l.browserReady ? styles.good : styles.errorText}>{l.browserReadyGateResult || '—'}</span>
          <span>Cache v{l.cacheVersion}</span><span>{l.cacheHit ? 'Hit' : 'Miss'}{l.cacheClearedThisRun ? ' (cleared)' : ''}</span>
          <span>GPU session</span><span className={l.gpuSessionInitialized ? styles.good : styles.muted}>{l.gpuSessionInitialized ? '✓' : '—'}</span>
          <span>Smoke test</span><span className={l.smokeTestPassed ? styles.good : l.aboutToRunSmokeTest ? styles.warnText : styles.muted}>
            {l.smokeTestPassed ? '✓ Passed' : l.aboutToRunSmokeTest ? '⏳ Running…' : '—'}
          </span>
          <span>Safe mode</span><span>{l.safeLoadMode ? 'ON' : 'OFF'}</span>
          {l.elapsedMs > 0 && <><span>Elapsed</span><span>{(l.elapsedMs / 1000).toFixed(1)}s</span></>}
        </div>

        {isLoading && l.combinedProgress > 0 && l.combinedProgress < 1 && (
          <>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${(l.combinedProgress * 100).toFixed(1)}%` }} />
            </div>
            <p className={styles.muted} style={{ fontSize: 10, marginTop: 2 }}>
              Tokenizer: {(l.tokenizerProgress * 100).toFixed(0)}% · Model: {(l.modelProgress * 100).toFixed(0)}%
            </p>
          </>
        )}

        <div className={styles.actions}>
          {isIdle && (
            <button className={styles.actionBtn} onClick={() => loadModel(safeLoadMode)}>
              {o.status === 'error' ? 'Retry' : 'Connect'}{safeLoadMode ? ' (Safe)' : ''}
            </button>
          )}
          {o.status === 'error' && (
            <>
              <button className={styles.actionBtnSecondary} onClick={unloadModel} style={{ marginLeft: 8 }}>Reset</button>
              <button className={styles.actionBtnSecondary} onClick={() => {
                ALL_MODELS.forEach((m) => clearModelCache(m));
                unloadModel();
              }} style={{ marginLeft: 8 }}>Clear Cache</button>
            </>
          )}
          {o.status === 'ready' && (
            <button className={styles.actionBtnSecondary} onClick={unloadModel}>Disconnect</button>
          )}
        </div>
      </div>

      {l.stageLog.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}><Activity size={12} /> Stage Log</h4>
          <div className={styles.logBox}>
            {l.stageLog.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      )}

      {o.status === 'error' && o.error && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}><AlertTriangle size={12} /> Error</h4>
          <p className={styles.failureBox}>{o.error}</p>
        </div>
      )}

      {metrics && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}><Brain size={12} /> Generation</h4>
          <div className={styles.grid}>
            <span>Source</span><span className={metrics.generationSource === 'step' ? styles.good : styles.warn}>
              {metrics.generationSource === 'step' ? (o.activeModel?.displayName ?? 'Model') : 'Unavailable'}
            </span>
            <span>Latency</span><span>{metrics.totalLatencyMs?.toFixed(0) ?? '–'} ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
