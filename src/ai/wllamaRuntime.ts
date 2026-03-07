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

interface WllamaInstance {
  loadModelFromUrl: (
    urls: string | string[],
    options?: {
      n_ctx?: number;
      n_threads?: number;
      progressCallback?: (progress: { loaded: number; total: number }) => void;
    },
  ) => Promise<void>;
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
  mmprojRequired: boolean;
  fileSizeBytes: number | null;
}

function emptyWllamaDiag(): WllamaDiagnostics {
  return {
    ...emptyDiagnostics('wllama'),
    ggufVariant: DEFAULT_GGUF_VARIANT,
    artifactChecks: [],
    mmprojCheck: null,
    mmprojRequired: false,
    fileSizeBytes: null,
  };
}

const STALL_TIMEOUT_MS = 120_000;

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
    this.diag = {
      ...this.diag,
      stage,
      subStatus,
      stageStartMs: performance.now(),
    };
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

    const wasmOk = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
    if (!wasmOk) {
      throw this.fail('checking-browser', 'WebAssembly not available in this browser.');
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
    this.initStart = performance.now();
    this.diag = { ...emptyWllamaDiag(), ggufVariant: this.diag.ggufVariant };

    await this.checkBrowserSupport();

    this.setStage('checking-memory', 'Checking device memory');
    const deviceMem = this.diag.memoryEstimateGB;
    if (deviceMem !== null && deviceMem < this.ggufConfig.estimatedRuntimeGB) {
      throw this.fail('checking-memory',
        `Device reports ${deviceMem} GB, model needs ~${this.ggufConfig.estimatedRuntimeGB} GB.`);
    }
    this.diag.memorySufficient = deviceMem === null ? null : true;

    this.setStage('checking-artifacts', 'Validating GGUF URLs');
    if (this.ggufConfig.urls.length === 0) {
      throw this.fail('checking-artifacts', 'No GGUF artifact URLs configured.');
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
    type WllamaConstructor = new (configPaths: Record<string, string>) => WllamaInstance;
    let WllamaClass: WllamaConstructor;
    try {
      const mod = await import('@wllama/wllama/esm');
      WllamaClass = (mod as unknown as { Wllama: WllamaConstructor }).Wllama;
    } catch (e) {
      throw this.fail('loading-runtime',
        `Failed to load wllama JS module: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.diag.subStatus = 'Wllama module loaded, creating instance';

    try {
      const wllamaBase = 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/';
      this.instance = new WllamaClass({
        'single-thread/wllama.js': wllamaBase + 'single-thread/wllama.js',
        'multi-thread/wllama.js': wllamaBase + 'multi-thread/wllama.js',
      });
    } catch (e) {
      throw this.fail('loading-runtime',
        `Failed to create wllama instance: ${e instanceof Error ? e.message : String(e)}`);
    }

    this.setStage('downloading-model', `Downloading ${this.ggufConfig.quantization} GGUF (${(this.diag.totalBytes / 1e9).toFixed(2)} GB)`);

    let lastProgressMs = performance.now();
    const stallChecker = setInterval(() => {
      const stallMs = performance.now() - lastProgressMs;
      if (stallMs > STALL_TIMEOUT_MS && this.diag.stage === 'downloading-model') {
        this.diag.subStatus = `Stalled — no progress for ${(stallMs / 1000).toFixed(0)}s. May be OOM or network issue.`;
      }
    }, 5000);

    try {
      const urls = this.ggufConfig.urls.length === 1
        ? this.ggufConfig.urls[0]
        : this.ggufConfig.urls;

      await this.instance.loadModelFromUrl(urls, {
        n_ctx: target.contextWindow,
        n_threads: Math.min(navigator.hardwareConcurrency ?? 2, 4),
        progressCallback: (p) => {
          lastProgressMs = performance.now();
          const pct = p.total > 0 ? p.loaded / p.total : 0;
          this.diag = {
            ...this.diag,
            downloadProgress: pct,
            downloadedBytes: p.loaded,
            totalBytes: p.total > 0 ? p.total : this.diag.totalBytes,
            subStatus: pct < 1
              ? `Downloading: ${(p.loaded / 1e6).toFixed(0)} / ${(p.total / 1e6).toFixed(0)} MB (${(pct * 100).toFixed(1)}%)`
              : 'Download complete, loading model into memory…',
          };
          if (pct >= 1 && this.diag.stage === 'downloading-model') {
            this.diag.stage = 'loading-model';
            this.diag.subStatus = 'Parsing GGUF, allocating context, loading tokenizer…';
          }
        },
      });
    } catch (e) {
      clearInterval(stallChecker);
      this.instance = null;
      const msg = e instanceof Error ? e.message : String(e);
      const stage = this.diag.stage === 'loading-model' ? 'loading-model' : 'downloading-model';
      const hint = msg.includes('memory') || msg.includes('OOM') || msg.includes('RangeError')
        ? ` This likely means the ${(this.diag.totalBytes / 1e9).toFixed(1)} GB file exceeds the browser's memory limit. Try Q3_K_M (3.84 GB) or split the GGUF into ≤512 MB shards.`
        : '';
      throw this.fail(stage, `${msg}${hint}`);
    }

    clearInterval(stallChecker);
    this.diag = {
      ...this.diag,
      stage: 'ready',
      downloadProgress: 1,
      subStatus: 'Model loaded and ready',
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
