import type { ModelProfile } from './modelProfiles';
import {
  type RuntimeBackend,
  type ConnectionDiagnostics,
  type ConnectionStage,
  type FailureCategory,
  emptyDiagnostics,
} from './runtimeTypes';

interface WllamaCacheManager {
  list(): Promise<{ name: string; size: number; metadata: { originalSize: number } }[]>;
  getNameFromURL(url: string): Promise<string>;
}

interface WllamaInstance {
  cacheManager: WllamaCacheManager;
  loadModelFromUrl(urls: string | string[], config?: Record<string, unknown>): Promise<void>;
  isModelLoaded(): boolean;
  createCompletion(prompt: string, options?: Record<string, unknown>): Promise<string>;
  exit(): Promise<void>;
}

const STALL_TIMEOUT_MS = 90_000;

async function checkQuota(): Promise<number | null> {
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      return e.quota && e.usage ? (e.quota - e.usage) / 1e9 : null;
    }
  } catch { /* */ }
  return null;
}

export class WllamaRuntime implements RuntimeBackend {
  readonly id = 'wllama' as const;
  private instance: WllamaInstance | null = null;
  private diag: ConnectionDiagnostics = emptyDiagnostics('wllama');
  private initStart = 0;

  getDiagnostics(): ConnectionDiagnostics {
    if (this.initStart > 0) this.diag.elapsedMs = performance.now() - this.initStart;
    return { ...this.diag };
  }

  private setStage(stage: ConnectionStage, sub: string) {
    this.diag = { ...this.diag, stage, subStatus: sub };
  }

  private fail(stage: ConnectionStage, cat: FailureCategory, reason: string): Error {
    this.diag = {
      ...this.diag, stage: 'failed', failureStage: stage,
      failureCategory: cat, failureReason: reason,
      subStatus: reason, elapsedMs: this.initStart > 0 ? performance.now() - this.initStart : 0,
    };
    return new Error(reason);
  }

  async initialize(profile: ModelProfile): Promise<void> {
    this.initStart = performance.now();
    this.diag = { ...emptyDiagnostics('wllama'), activeProfile: profile };

    this.setStage('checking-browser', 'Checking WASM support');
    if (typeof WebAssembly !== 'object') {
      throw this.fail('checking-browser', 'unsupported_browser', 'WebAssembly not available.');
    }
    const nav = globalThis.navigator as Navigator & { deviceMemory?: number };
    this.diag.browserCompatible = true;
    this.diag.memoryEstimateGB = nav.deviceMemory ?? null;

    this.setStage('checking-storage', 'Checking storage quota');
    const avail = await checkQuota();
    this.diag.quotaAvailableGB = avail;
    const requiredGB = profile.fileSizeBytes / 1e9;
    if (avail !== null && avail < requiredGB * 1.1) {
      throw this.fail('checking-storage', 'insufficient_storage',
        `Need ~${requiredGB.toFixed(1)} GB, only ${avail.toFixed(1)} GB available.`);
    }

    this.setStage('checking-artifacts', `Checking ${profile.displayName}`);
    try {
      const r = await fetch(profile.modelUrl, { method: 'HEAD', mode: 'cors', redirect: 'follow' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.diag.artifactsAvailable = true;
    } catch (e) {
      throw this.fail('checking-artifacts', 'artifact_missing',
        `${profile.displayName} GGUF not reachable: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.diag.totalBytes = profile.fileSizeBytes;

    this.setStage('loading-runtime', 'Loading wllama WASM runtime');
    type WC = new (p: Record<string, string>, c?: Record<string, unknown>) => WllamaInstance;
    let Wllama: WC;
    try {
      const mod = await import('@wllama/wllama/esm');
      Wllama = (mod as unknown as { Wllama: WC }).Wllama;
    } catch (e) {
      throw this.fail('loading-runtime', 'runtime_import_failed',
        `Failed to load wllama: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const base = 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/src/';
      this.instance = new Wllama(
        { 'single-thread/wllama.wasm': base + 'single-thread/wllama.wasm',
          'multi-thread/wllama.wasm': base + 'multi-thread/wllama.wasm' },
        { allowOffline: true },
      );
    } catch (e) {
      throw this.fail('loading-runtime', 'wasm_init_failed',
        `Failed to create wllama: ${e instanceof Error ? e.message : String(e)}`);
    }

    this.setStage('downloading-model', `Loading ${profile.displayName} (${requiredGB.toFixed(1)} GB)`);

    let cached = false;
    try {
      const entries = await this.instance.cacheManager.list();
      const name = await this.instance.cacheManager.getNameFromURL(profile.modelUrl);
      const m = entries.find((e) => e.name === name);
      if (m && m.size > 0 && m.size === m.metadata.originalSize) {
        cached = true;
        this.diag.loadSource = 'cache';
        this.diag.subStatus = `Loading from cache (${(m.size / 1e9).toFixed(2)} GB)`;
      }
    } catch { /* proceed with download */ }

    if (!cached) {
      this.diag.loadSource = 'network';
      try { await navigator.storage.persist?.(); } catch { /* */ }
    }

    let lastProgress = performance.now();
    const stall = setInterval(() => {
      if (performance.now() - lastProgress > STALL_TIMEOUT_MS) {
        this.diag.subStatus = `Stalled ${((performance.now() - lastProgress) / 1000).toFixed(0)}s — possible memory pressure`;
      }
    }, 5000);

    try {
      await this.instance.loadModelFromUrl(profile.modelUrl, {
        n_ctx: profile.contextWindow,
        n_threads: Math.min(nav.hardwareConcurrency ?? 2, 2),
        cache_type_k: 'q4_0',
        cache_type_v: 'q4_0',
        progressCallback: (p: { loaded: number; total: number }) => {
          lastProgress = performance.now();
          const pct = p.total > 0 ? p.loaded / p.total : 0;
          this.diag.downloadProgress = pct;
          this.diag.downloadedBytes = p.loaded;
          this.diag.totalBytes = p.total > 0 ? p.total : this.diag.totalBytes;
          this.diag.subStatus = pct < 1
            ? `${cached ? 'Loading' : 'Downloading'}: ${(p.loaded / 1e6).toFixed(0)}/${(p.total / 1e6).toFixed(0)} MB (${(pct * 100).toFixed(0)}%)`
            : 'Initializing model…';
          if (pct >= 1 && this.diag.stage !== 'loading-model') {
            this.diag.stage = 'loading-model';
          }
        },
      });
    } catch (e) {
      clearInterval(stall);
      this.instance = null;
      const msg = e instanceof Error ? e.message : String(e);
      const cat: FailureCategory = msg.includes('magic') || msg.includes('abort')
        ? 'memory_load_failed'
        : msg.includes('quota') ? 'insufficient_storage' : 'unknown_runtime_failure';
      const hint = cat === 'memory_load_failed'
        ? ' Runtime memory failure during model init — not a missing artifact.'
        : '';
      throw this.fail(this.diag.stage === 'loading-model' ? 'loading-model' : 'downloading-model', cat, msg + hint);
    }

    clearInterval(stall);
    this.diag = {
      ...this.diag, stage: 'ready', downloadProgress: 1,
      subStatus: `${profile.displayName} ready (${this.diag.loadSource})`,
      elapsedMs: performance.now() - this.initStart,
    };
  }

  async generate(prompt: string, maxTokens: number, temperature: number): Promise<string> {
    if (!this.instance) throw new Error('Not initialized');
    return this.instance.createCompletion(prompt, {
      nPredict: maxTokens, temperature,
      sampling: { top_p: 0.9, repeat_penalty: 1.1 },
    }) as Promise<string>;
  }

  async unload(): Promise<void> {
    if (this.instance) {
      try { await this.instance.exit(); } catch { /* */ }
      this.instance = null;
    }
    this.initStart = 0;
    this.diag = emptyDiagnostics('wllama');
  }
}
