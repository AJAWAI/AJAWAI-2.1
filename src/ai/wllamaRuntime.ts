import type { DeploymentTarget } from './modelProfiles';
import {
  type RuntimeBackend,
  type ConnectionDiagnostics,
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

export class WllamaRuntime implements RuntimeBackend {
  readonly id = 'wllama' as const;
  private instance: WllamaInstance | null = null;
  private diag: WllamaDiagnostics = emptyWllamaDiag();
  private ggufConfig: GgufArtifactConfig;

  constructor(variant: string = DEFAULT_GGUF_VARIANT) {
    this.ggufConfig = STEP_GGUF_ARTIFACTS[variant] ?? STEP_GGUF_ARTIFACTS[DEFAULT_GGUF_VARIANT];
    this.diag.ggufVariant = variant;
  }

  getDiagnostics(): WllamaDiagnostics {
    return { ...this.diag };
  }

  async checkBrowserSupport(): Promise<boolean> {
    this.diag = { ...this.diag, stage: 'checking-browser' };

    const wasmOk = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
    if (!wasmOk) {
      this.diag = {
        ...this.diag,
        browserCompatible: false,
        failureReason: 'WebAssembly not available in this browser.',
        failureStage: 'checking-browser',
        stage: 'failed',
      };
      return false;
    }

    const nav = globalThis.navigator as Navigator & { deviceMemory?: number };
    this.diag = {
      ...this.diag,
      browserCompatible: true,
      memoryEstimateGB: nav.deviceMemory ?? null,
    };
    return true;
  }

  async initialize(target: DeploymentTarget): Promise<void> {
    this.diag = { ...emptyWllamaDiag(), ggufVariant: this.diag.ggufVariant, stage: 'checking-browser' };

    const supported = await this.checkBrowserSupport();
    if (!supported) throw new Error(this.diag.failureReason || 'Browser not compatible');

    const deviceMem = this.diag.memoryEstimateGB;
    this.diag = { ...this.diag, stage: 'checking-memory' };
    if (deviceMem !== null && deviceMem < this.ggufConfig.estimatedRuntimeGB) {
      const reason = `Insufficient memory: device reports ${deviceMem} GB, model needs ~${this.ggufConfig.estimatedRuntimeGB} GB. Model may still load but could be slow or crash.`;
      this.diag = { ...this.diag, memorySufficient: false, failureReason: reason, failureStage: 'checking-memory', stage: 'failed' };
      throw new Error(reason);
    }
    this.diag = { ...this.diag, memorySufficient: deviceMem === null ? null : true };

    this.diag = { ...this.diag, stage: 'checking-artifacts' };

    if (this.ggufConfig.urls.length === 0) {
      const reason = 'No GGUF artifact URLs configured.';
      this.diag = { ...this.diag, artifactsAvailable: false, failureReason: reason, failureStage: 'checking-artifacts', stage: 'failed' };
      throw new Error(reason);
    }

    const validation = await validateGgufArtifacts(this.ggufConfig);
    this.diag = {
      ...this.diag,
      artifactChecks: validation.checks,
      mmprojCheck: validation.mmprojCheck,
    };

    if (!validation.valid) {
      const failedFiles = validation.checks.filter((c) => !c.reachable);
      const details = failedFiles.map((f) => `${f.label}: ${f.error ?? 'unreachable'}`).join('; ');
      const reason = `GGUF artifacts not reachable: ${details}`;
      this.diag = { ...this.diag, artifactsAvailable: false, failureReason: reason, failureStage: 'checking-artifacts', stage: 'failed' };
      throw new Error(reason);
    }

    const totalSize = validation.checks.reduce((sum, c) => sum + (c.contentLength ?? 0), 0);
    this.diag = {
      ...this.diag,
      artifactsAvailable: true,
      fileSizeBytes: totalSize > 0 ? totalSize : null,
      mmprojRequired: false,
    };

    this.diag = { ...this.diag, stage: 'downloading' };

    type WllamaConstructor = new (configPaths: Record<string, string>) => WllamaInstance;
    let WllamaClass: WllamaConstructor;
    try {
      const mod = await import('@wllama/wllama/esm');
      WllamaClass = (mod as unknown as { Wllama: WllamaConstructor }).Wllama;
    } catch (e) {
      const reason = `Failed to load wllama runtime: ${e instanceof Error ? e.message : String(e)}`;
      this.diag = { ...this.diag, failureReason: reason, failureStage: 'downloading', stage: 'failed' };
      throw new Error(reason);
    }

    this.diag = { ...this.diag, stage: 'initializing' };

    try {
      const wllamaBase = 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/';
      this.instance = new WllamaClass({
        'single-thread/wllama.js': wllamaBase + 'single-thread/wllama.js',
        'multi-thread/wllama.js': wllamaBase + 'multi-thread/wllama.js',
      });

      const urls = this.ggufConfig.urls.length === 1
        ? this.ggufConfig.urls[0]
        : this.ggufConfig.urls;

      await this.instance.loadModelFromUrl(urls, {
        n_ctx: target.contextWindow,
        progressCallback: (p) => {
          const progress = p.total > 0 ? p.loaded / p.total : 0;
          this.diag = { ...this.diag, downloadProgress: progress };
        },
      });
    } catch (e) {
      this.instance = null;
      const reason = `Wllama init failed: ${e instanceof Error ? e.message : String(e)}`;
      this.diag = { ...this.diag, failureReason: reason, failureStage: 'initializing', stage: 'failed' };
      throw new Error(reason);
    }

    this.diag = { ...this.diag, stage: 'ready', downloadProgress: 1 };
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
    this.diag = emptyWllamaDiag();
  }
}
