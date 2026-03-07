import type { DeploymentTarget } from './modelProfiles';
import {
  type RuntimeBackend,
  type ConnectionDiagnostics,
  type ArtifactCheckResult,
  emptyDiagnostics,
} from './runtimeTypes';

type WebLLMEngine = {
  chat: {
    completions: {
      create: (params: {
        messages: { role: string; content: string }[];
        max_tokens?: number;
        temperature?: number;
        stream?: boolean;
      }) => Promise<{ choices: { message: { content: string } }[] }>;
    };
  };
  unload: () => Promise<void>;
};

type CreateMLCEngineFn = (
  modelId: string,
  options?: {
    appConfig?: {
      model_list: {
        model: string;
        model_id: string;
        model_lib: string;
      }[];
    };
    initProgressCallback?: (report: { text: string; progress: number }) => void;
  },
) => Promise<WebLLMEngine>;

async function checkUrl(label: string, url: string): Promise<ArtifactCheckResult> {
  try {
    const r = await fetch(url, { method: 'HEAD', mode: 'cors' });
    if (r.ok) return { file: label, url, status: 'ok', httpStatus: r.status };
    if (r.status === 401 || r.status === 403) return { file: label, url, status: 'forbidden', httpStatus: r.status };
    return { file: label, url, status: 'missing', httpStatus: r.status };
  } catch {
    return { file: label, url, status: 'error', httpStatus: null };
  }
}

export class WebLLMRuntime implements RuntimeBackend {
  readonly id = 'webllm' as const;
  private engine: WebLLMEngine | null = null;
  private diag: ConnectionDiagnostics = emptyDiagnostics('webllm');

  getDiagnostics(): ConnectionDiagnostics {
    return { ...this.diag };
  }

  async checkBrowserSupport(): Promise<boolean> {
    this.diag = { ...this.diag, stage: 'checking-browser' };

    const nav = globalThis.navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<unknown | null> };
      deviceMemory?: number;
    };

    if (!nav.gpu) {
      this.diag = {
        ...this.diag,
        browserCompatible: false,
        failureReason: 'WebGPU not available. Requires Chrome 113+ or compatible browser with WebGPU enabled.',
        failureStage: 'checking-browser',
        stage: 'failed',
      };
      return false;
    }

    try {
      const adapter = await nav.gpu.requestAdapter();
      if (!adapter) {
        this.diag = {
          ...this.diag,
          browserCompatible: false,
          failureReason: 'WebGPU adapter not found. GPU may not support WebGPU, or it is disabled.',
          failureStage: 'checking-browser',
          stage: 'failed',
        };
        return false;
      }
    } catch (e) {
      this.diag = {
        ...this.diag,
        browserCompatible: false,
        failureReason: `WebGPU init error: ${e instanceof Error ? e.message : String(e)}`,
        failureStage: 'checking-browser',
        stage: 'failed',
      };
      return false;
    }

    this.diag = {
      ...this.diag,
      browserCompatible: true,
      memoryEstimateGB: nav.deviceMemory ?? null,
    };
    return true;
  }

  async initialize(target: DeploymentTarget): Promise<void> {
    this.diag = { ...emptyDiagnostics('webllm'), stage: 'checking-browser' };

    const supported = await this.checkBrowserSupport();
    if (!supported) throw new Error(this.diag.failureReason || 'Browser not compatible');

    const deviceMem = this.diag.memoryEstimateGB;
    this.diag = { ...this.diag, stage: 'checking-memory' };
    if (deviceMem !== null && deviceMem < target.estimatedRuntimeMemoryGB) {
      const reason = `Insufficient memory: device reports ${deviceMem} GB, model needs ~${target.estimatedRuntimeMemoryGB} GB.`;
      this.diag = { ...this.diag, memorySufficient: false, failureReason: reason, failureStage: 'checking-memory', stage: 'failed' };
      throw new Error(reason);
    }
    this.diag = { ...this.diag, memorySufficient: deviceMem === null ? null : true };

    this.diag = { ...this.diag, stage: 'checking-artifacts' };

    if (!target.artifacts || !target.artifacts.mlc) {
      const reason = 'Model artifacts not configured. STEP-3-VL-10B MLC-format weights have not been published yet. Required files: ndarray-cache.json, tokenizer.json, mlc-chat-config.json, model library WASM, weight shards.';
      this.diag = { ...this.diag, artifactsAvailable: false, failureReason: reason, failureStage: 'checking-artifacts', stage: 'failed' };
      throw new Error(reason);
    }

    const mlc = target.artifacts.mlc;
    const checks = await Promise.all([
      checkUrl('mlc-chat-config.json', mlc.mlcChatConfigUrl),
      checkUrl('tokenizer.json', mlc.tokenizerUrl),
      checkUrl('model library (.wasm)', mlc.modelLibWasmUrl),
      checkUrl('weight index (ndarray-cache)', mlc.modelWeightsUrl + 'ndarray-cache.json'),
    ]);

    this.diag = { ...this.diag, artifactChecks: checks };

    const failures = checks.filter((c) => c.status !== 'ok');
    if (failures.length > 0) {
      const details = failures.map((f) => {
        if (f.status === 'forbidden') return `${f.file}: access denied (HTTP ${f.httpStatus})`;
        if (f.status === 'missing') return `${f.file}: not found (HTTP ${f.httpStatus})`;
        return `${f.file}: unreachable`;
      });
      const reason = `Model artifacts ${failures.some((f) => f.status === 'forbidden') ? 'private or' : ''} missing:\n${details.join('\n')}`;
      this.diag = { ...this.diag, artifactsAvailable: false, failureReason: reason, failureStage: 'checking-artifacts', stage: 'failed' };
      throw new Error(reason);
    }
    this.diag = { ...this.diag, artifactsAvailable: true };

    this.diag = { ...this.diag, stage: 'downloading' };

    let CreateMLCEngine: CreateMLCEngineFn;
    try {
      const webllm = await import('@mlc-ai/web-llm');
      CreateMLCEngine = webllm.CreateMLCEngine as unknown as CreateMLCEngineFn;
    } catch (e) {
      const reason = `Failed to load web-llm runtime: ${e instanceof Error ? e.message : String(e)}`;
      this.diag = { ...this.diag, failureReason: reason, failureStage: 'downloading', stage: 'failed' };
      throw new Error(reason);
    }

    this.diag = { ...this.diag, stage: 'initializing' };
    try {
      this.engine = await CreateMLCEngine(mlc.mlcModelId, {
        appConfig: {
          model_list: [{
            model: mlc.modelWeightsUrl,
            model_id: mlc.mlcModelId,
            model_lib: mlc.modelLibWasmUrl,
          }],
        },
        initProgressCallback: (report) => {
          this.diag = { ...this.diag, downloadProgress: report.progress };
        },
      });
    } catch (e) {
      const reason = `Runtime init failed: ${e instanceof Error ? e.message : String(e)}`;
      this.diag = { ...this.diag, failureReason: reason, failureStage: 'initializing', stage: 'failed' };
      throw new Error(reason);
    }

    this.diag = { ...this.diag, stage: 'ready', downloadProgress: 1 };
  }

  async generate(prompt: string, maxTokens: number, temperature: number): Promise<string> {
    if (!this.engine) throw new Error('Engine not initialized');

    const result = await this.engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
      stream: false,
    });

    return result.choices[0]?.message?.content ?? '';
  }

  async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
    }
    this.diag = emptyDiagnostics('webllm');
  }
}
