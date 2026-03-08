import type { DeploymentTarget } from './modelProfiles';
import {
  type RuntimeBackend,
  type ConnectionDiagnostics,
  type ConnectionStage,
  emptyDiagnostics,
} from './runtimeTypes';
import {
  STEP_GGUF_ARTIFACTS,
  DEFAULT_GGUF_VARIANT,
  validateGgufArtifacts,
  type GgufArtifactConfig,
  type ArtifactCheckResult,
} from './ggufArtifacts';

interface CacheEntry {
  name: string;
  size: number;
  metadata: { originalSize: number; originalURL: string; etag: string };
}

interface WllamaCacheManager {
  list(): Promise<CacheEntry[]>;
  getNameFromURL(url: string): Promise<string>;
  getSize(name: string): Promise<number>;
  clear(): Promise<void>;
  delete(nameOrURL: string): Promise<void>;
}

interface WllamaInstance {
  cacheManager: WllamaCacheManager;
  loadModelFromUrl: (
    urls: string | string[],
    options?: {
      n_ctx?: number;
      n_threads?: number;
      cache_type_k?: string;
      cache_type_v?: string;
      allowOffline?: boolean;
      progressCallback?: (progress: { loaded: number; total: number }) => void;
    },
  ) => Promise<void>;
  isModelLoaded(): boolean;
  createCompletion: (
    prompt: string,
    options?: {
      nPredict?: number;
      temperature?: number;
      sampling?: { top_p?: number; repeat_penalty?: number };
    },
  ) => Promise<string>;
  exit: () => Promise<void>;
}

export interface WllamaDiagnostics extends ConnectionDiagnostics {
  ggufVariant: string;
  artifactChecks: ArtifactCheckResult[];
  mmprojCheck: ArtifactCheckResult | null;
  fileSizeBytes: number | null;
  storageBackend: string;
  quotaTotalGB: number | null;
  quotaUsedGB: number | null;
  quotaAvailableGB: number | null;
  installedLocally: boolean;
  loadSource: 'network' | 'cache' | 'unknown';
}

function emptyWllamaDiag(): WllamaDiagnostics {
  return {
    ...emptyDiagnostics('wllama'),
    ggufVariant: DEFAULT_GGUF_VARIANT,
    artifactChecks: [],
    mmprojCheck: null,
    fileSizeBytes: null,
    storageBackend: 'opfs',
    quotaTotalGB: null,
    quotaUsedGB: null,
    quotaAvailableGB: null,
    installedLocally: false,
    loadSource: 'unknown',
  };
}

const STALL_TIMEOUT_MS = 120_000;

async function checkStorageQuota(): Promise<{ totalGB: number | null; usedGB: number | null; availableGB: number | null }> {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const total = est.quota ?? null;
      const used = est.usage ?? null;
      return {
        totalGB: total ? total / 1e9 : null,
        usedGB: used ? used / 1e9 : null,
        availableGB: total && used ? (total - used) / 1e9 : null,
      };
    }
  } catch { /* unavailable */ }
  return { totalGB: null, usedGB: null, availableGB: null };
}

export class WllamaRuntime implements RuntimeBackend {
  readonly id = 'wllama' as const;
  private instance: WllamaInstance | null = null;
  private diag: WllamaDiagnostics = emptyWllamaDiag();
  private ggufConfig: GgufArtifactConfig;
  private initStart = 0;

  constructor(variant: string = DEFAULT_GGUF_VARIANT) {
    this.ggufConfig = STEP_GGUF_ARTIFACTS[variant] ?? STEP_GGUF_ARTIFACTS[DEFAULT_GGUF_VARIANT];
    this.diag.ggufVariant = variant;
  }

  getDiagnostics(): WllamaDiagnostics {
    if (this.initStart > 0) {
      this.diag.elapsedMs = performance.now() - this.initStart;
    }
    return { ...this.diag };
  }

  private setStage(stage: ConnectionStage, subStatus: string) {
    this.diag = { ...this.diag, stage, subStatus, stageStartMs: performance.now() };
  }

  private fail(stage: ConnectionStage, reason: string): Error {
    this.diag = {
      ...this.diag,
      stage: 'failed',
      failureStage: stage,
      failureReason: reason,
      subStatus: `Failed: ${reason}`,
      elapsedMs: this.initStart > 0 ? performance.now() - this.initStart : 0,
    };
    return new Error(reason);
  }

  async checkBrowserSupport(): Promise<boolean> {
    this.setStage('checking-browser', 'Checking WebAssembly support');
    if (typeof WebAssembly !== 'object' || typeof WebAssembly.instantiate !== 'function') {
      throw this.fail('checking-browser', 'WebAssembly not available.');
    }
    const nav = globalThis.navigator as Navigator & { deviceMemory?: number };
    this.diag = {
      ...this.diag,
      browserCompatible: true,
      memoryEstimateGB: nav.deviceMemory ?? null,
      subStatus: 'Browser OK',
    };
    return true;
  }

  async initialize(target: DeploymentTarget): Promise<void> {
    void target;
    this.initStart = performance.now();
    this.diag = { ...emptyWllamaDiag(), ggufVariant: this.diag.ggufVariant };

    await this.checkBrowserSupport();

    this.setStage('checking-memory', 'Checking storage quota');
    const quota = await checkStorageQuota();
    this.diag.quotaTotalGB = quota.totalGB;
    this.diag.quotaUsedGB = quota.usedGB;
    this.diag.quotaAvailableGB = quota.availableGB;

    const deviceMem = this.diag.memoryEstimateGB;
    this.diag.memorySufficient = deviceMem === null ? null : deviceMem >= this.ggufConfig.estimatedRuntimeGB;

    const requiredGB = this.ggufConfig.fileSizeBytes / 1e9;
    if (quota.availableGB !== null && quota.availableGB < requiredGB * 1.1) {
      throw this.fail('checking-memory',
        `Storage quota insufficient: ${quota.availableGB.toFixed(1)} GB available, need ~${requiredGB.toFixed(1)} GB. ` +
        `Used: ${quota.usedGB?.toFixed(1) ?? '?'} GB / ${quota.totalGB?.toFixed(1) ?? '?'} GB total. ` +
        `Try clearing browser storage or site data.`);
    }

    this.setStage('checking-artifacts', 'Validating GGUF URLs');
    if (this.ggufConfig.urls.length === 0) {
      throw this.fail('checking-artifacts', 'No GGUF URLs configured.');
    }

    const validation = await validateGgufArtifacts(this.ggufConfig);
    this.diag.artifactChecks = validation.checks;
    this.diag.mmprojCheck = validation.mmprojCheck;

    if (!validation.valid) {
      const failedFiles = validation.checks.filter((c) => !c.reachable);
      const details = failedFiles.map((f) => `${f.label}: ${f.error ?? 'unreachable'}`).join('; ');
      throw this.fail('checking-artifacts', `GGUF not reachable: ${details}`);
    }

    const totalSize = validation.checks.reduce((sum, c) => sum + (c.contentLength ?? 0), 0);
    this.diag.artifactsAvailable = true;
    this.diag.fileSizeBytes = totalSize > 0 ? totalSize : this.ggufConfig.fileSizeBytes;
    this.diag.totalBytes = totalSize > 0 ? totalSize : this.ggufConfig.fileSizeBytes;

    this.setStage('loading-runtime', 'Loading wllama WASM runtime');
    type WllamaConstructor = new (
      pathConfig: Record<string, string>,
      config?: { allowOffline?: boolean },
    ) => WllamaInstance;
    let WllamaClass: WllamaConstructor;
    try {
      const mod = await import('@wllama/wllama/esm');
      WllamaClass = (mod as unknown as { Wllama: WllamaConstructor }).Wllama;
    } catch (e) {
      throw this.fail('loading-runtime',
        `Failed to load wllama module: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.diag.subStatus = 'Creating wllama instance';

    try {
      const wllamaBase = 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/src/';
      this.instance = new WllamaClass(
        {
          'single-thread/wllama.wasm': wllamaBase + 'single-thread/wllama.wasm',
          'multi-thread/wllama.wasm': wllamaBase + 'multi-thread/wllama.wasm',
        },
        { allowOffline: true },
      );
    } catch (e) {
      throw this.fail('loading-runtime',
        `Failed to create wllama instance: ${e instanceof Error ? e.message : String(e)}`);
    }

    this.setStage('downloading-model', 'Checking local cache (OPFS)');
    this.diag.storageBackend = 'opfs';

    let cachedLocally = false;
    try {
      const cache = this.instance.cacheManager;
      const entries = await cache.list();
      const modelUrl = this.ggufConfig.urls[0];
      const expectedName = await cache.getNameFromURL(modelUrl);
      const match = entries.find((e) => e.name === expectedName);
      if (match && match.size > 0 && match.metadata.originalSize > 0 && match.size === match.metadata.originalSize) {
        cachedLocally = true;
        this.diag.installedLocally = true;
        this.diag.loadSource = 'cache';
        this.diag.subStatus = `Found in local cache (${(match.size / 1e9).toFixed(2)} GB). Loading from OPFS…`;
      }
    } catch {
      /* cache check failed, proceed with download */
    }

    if (!cachedLocally) {
      this.diag.loadSource = 'network';
      this.diag.subStatus = `Downloading ${this.ggufConfig.quantization} GGUF (${(this.diag.totalBytes / 1e9).toFixed(2)} GB) to OPFS`;

      try {
        await navigator.storage.persist?.();
      } catch { /* best effort */ }
    }

    let lastProgressMs = performance.now();
    const stallChecker = setInterval(() => {
      const stallMs = performance.now() - lastProgressMs;
      if (stallMs > STALL_TIMEOUT_MS && (this.diag.stage === 'downloading-model' || this.diag.stage === 'loading-model')) {
        this.diag.subStatus = `Stalled — no progress for ${(stallMs / 1000).toFixed(0)}s`;
      }
    }, 5000);

    try {
      const urls = this.ggufConfig.urls.length === 1
        ? this.ggufConfig.urls[0]
        : this.ggufConfig.urls;

      await this.instance.loadModelFromUrl(urls, {
        n_ctx: this.ggufConfig.contextWindow,
        n_threads: Math.min(navigator.hardwareConcurrency ?? 2, 2),
        cache_type_k: 'q4_0',
        cache_type_v: 'q4_0',
        progressCallback: (p) => {
          lastProgressMs = performance.now();
          const pct = p.total > 0 ? p.loaded / p.total : 0;
          this.diag = {
            ...this.diag,
            downloadProgress: pct,
            downloadedBytes: p.loaded,
            totalBytes: p.total > 0 ? p.total : this.diag.totalBytes,
          };
          if (pct < 1) {
            this.diag.subStatus = cachedLocally
              ? `Loading from cache: ${(p.loaded / 1e6).toFixed(0)} / ${(p.total / 1e6).toFixed(0)} MB`
              : `Downloading: ${(p.loaded / 1e6).toFixed(0)} / ${(p.total / 1e6).toFixed(0)} MB (${(pct * 100).toFixed(1)}%)`;
          } else {
            this.diag.stage = 'loading-model';
            this.diag.subStatus = 'Parsing GGUF, allocating context…';
          }
        },
      });
    } catch (e) {
      clearInterval(stallChecker);
      this.instance = null;
      const msg = e instanceof Error ? e.message : String(e);
      const stage = this.diag.stage === 'loading-model' ? 'loading-model' : 'downloading-model';

      let hint = '';
      if (msg.includes('quota') || msg.includes('QuotaExceededError') || msg.includes('storage quota')) {
        const refreshedQuota = await checkStorageQuota();
        hint = ` Storage quota exceeded. Available: ${refreshedQuota.availableGB?.toFixed(1) ?? '?'} GB, needed: ~${requiredGB.toFixed(1)} GB. Clear site data in browser settings and retry.`;
      } else if (msg.includes('magic') || msg.includes('abort signal') || msg.includes('abort')) {
        hint = ` This is a runtime memory/load failure — NOT a missing artifact. The ${requiredGB.toFixed(1)} GB model passed download but the browser ran out of memory during WASM model initialization (GGUF parsing, weight loading, or context allocation). Try closing other tabs, clearing browser cache, or restarting the browser.`;
      } else if (msg.includes('RangeError') || msg.includes('out of memory') || msg.includes('OOM')) {
        hint = ` Browser memory limit hit. The ${requiredGB.toFixed(1)} GB model may need to be split into ≤512 MB shards.`;
      }
      throw this.fail(stage, `${msg}${hint}`);
    }

    clearInterval(stallChecker);
    this.diag = {
      ...this.diag,
      stage: 'ready',
      downloadProgress: 1,
      installedLocally: true,
      subStatus: `Model loaded (${this.diag.loadSource === 'cache' ? 'from local cache' : 'downloaded & cached'})`,
      elapsedMs: performance.now() - this.initStart,
    };
  }

  async generate(prompt: string, maxTokens: number, temperature: number): Promise<string> {
    if (!this.instance) throw new Error('Wllama not initialized');
    return this.instance.createCompletion(prompt, {
      nPredict: maxTokens,
      temperature,
      sampling: { top_p: 0.9, repeat_penalty: 1.1 },
    });
  }

  async unload(): Promise<void> {
    if (this.instance) {
      try { await this.instance.exit(); } catch { /* best effort */ }
      this.instance = null;
    }
    this.initStart = 0;
    this.diag = emptyWllamaDiag();
  }
}
