import { Activity, Cpu, HardDrive, Loader, Brain, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useModelStore } from '../../store/modelStore';
import { useChatStore } from '../../store/chatStore';
import { ALL_MODELS } from '../../ai/runtime/modelRegistry';
import styles from './DebugPanel.module.css';

export function DebugPanel() {
  const show = useSettingsStore((s) => s.showDebugPanel);
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
        <h4 className={styles.sectionTitle}><HardDrive size={12} /> Models</h4>
        <div className={styles.grid}>
          {ALL_MODELS.map((m) => (
            <span key={m.modelId} style={{ gridColumn: '1 / -1' }}
              className={o.activeModel?.modelId === m.modelId ? styles.good : styles.muted}>
              {o.activeModel?.modelId === m.modelId ? '▶ ' : '  '}
              {m.displayName} ({m.quantization}, {m.estimatedRAM_GB} GB, {m.role})
            </span>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}><HardDrive size={12} /> Status</h4>
        <div className={styles.grid}>
          <span>Active</span>
          <span className={o.status === 'ready' ? styles.good : undefined}>
            {o.activeModel?.displayName ?? 'None'}
          </span>
          <span>Status</span>
          <span data-status={o.status} className={styles.statusBadge}>
            {isLoading && <Loader size={10} className={styles.spin} />}
            {o.status}
          </span>
          {l.modelPackage && <><span>Package</span><span className={styles.muted}>{l.modelPackage}</span></>}
          {l.runtime && <><span>Runtime</span><span>{l.runtime}</span></>}
          <span>Cache v{l.cacheVersion}</span><span>{l.cached ? 'Hit' : 'Miss'}</span>
          <span>Smoke test</span><span className={l.smokeTestPassed ? styles.good : styles.muted}>{l.smokeTestPassed ? 'Passed' : '—'}</span>
          {o.visionDisabled && <><span>Vision</span><span className={styles.muted}>Disabled</span></>}
          {l.elapsedMs > 0 && <><span>Elapsed</span><span>{(l.elapsedMs / 1000).toFixed(1)}s</span></>}
        </div>

        {isLoading && l.progress > 0 && l.progress < 1 && (
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${(l.progress * 100).toFixed(1)}%` }} />
          </div>
        )}

        {o.fallbackTriggered && (
          <p className={styles.warnBox}><strong>Fallback</strong><br />{o.fallbackReason}</p>
        )}

        <div className={styles.actions}>
          {isIdle && (
            <button className={styles.actionBtn} onClick={() => loadModel()}>
              {o.status === 'error' ? 'Retry' : 'Connect'}
            </button>
          )}
          {o.status === 'error' && (
            <button className={styles.actionBtnSecondary} onClick={unloadModel} style={{ marginLeft: 8 }}>Reset</button>
          )}
          {o.status === 'ready' && (
            <button className={styles.actionBtnSecondary} onClick={unloadModel}>Disconnect</button>
          )}
        </div>
      </div>

      {o.status === 'error' && o.error && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}><AlertTriangle size={12} /> Error</h4>
          <p className={styles.failureBox}>{o.error}</p>
        </div>
      )}

      {metrics && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}><Brain size={12} /> Last Generation</h4>
          <div className={styles.grid}>
            <span>Source</span><span className={metrics.generationSource === 'step' ? styles.good : styles.warn}>
              {metrics.generationSource === 'step' ? (o.activeModel?.displayName ?? 'Model') : 'Unavailable'}
            </span>
            <span>Latency</span><span>{metrics.totalLatencyMs?.toFixed(0) ?? '–'} ms</span>
            <span>Tokens</span><span>{metrics.promptTokens}</span>
          </div>
        </div>
      )}
    </div>
  );
}
