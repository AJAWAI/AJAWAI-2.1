import type { DeploymentTarget } from './modelProfiles';
import {
  type RuntimeBackend,
  type ConnectionDiagnostics,
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

    const deviceMemory = nav.deviceMemory ?? null;
    this.diag = {
      ...this.diag,
      browserCompatible: true,
      memoryEstimateGB: deviceMemory,
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
      this.diag = {
        ...this.diag,
        memorySufficient: false,
        failureReason: `Insufficient memory: device reports ${deviceMem} GB, model needs ~${target.estimatedRuntimeMemoryGB} GB.`,
        failureStage: 'checking-memory',
        stage: 'failed',
      };
      throw new Error(this.diag.failureReason || 'Insufficient memory');
    }
    this.diag = { ...this.diag, memorySufficient: deviceMem === null ? null : true };

    this.diag = { ...this.diag, stage: 'checking-artifacts' };
    if (!target.artifacts) {
      this.diag = {
        ...this.diag,
        artifactsAvailable: false,
        failureReason: 'No artifact URLs configured for this deployment target.',
        failureStage: 'checking-artifacts',
        stage: 'failed',
      };
      throw new Error(this.diag.failureReason || 'No artifacts');
    }

    try {
      const response = await fetch(target.artifacts.modelUrl, { method: 'HEAD' });
      if (!response.ok) {
        this.diag = {
          ...this.diag,
          artifactsAvailable: false,
          failureReason: `Model artifacts not found at ${target.artifacts.modelUrl} (HTTP ${response.status}).`,
          failureStage: 'checking-artifacts',
          stage: 'failed',
        };
        throw new Error(this.diag.failureReason || 'Artifacts not found');
      }
    } catch (e) {
      if (this.diag.stage === 'failed') throw e;
      const reason = `Cannot reach model artifacts: ${e instanceof Error ? e.message : String(e)}`;
      this.diag = {
        ...this.diag,
        artifactsAvailable: false,
        failureReason: reason,
        failureStage: 'checking-artifacts',
        stage: 'failed',
      };
      throw new Error(reason);
    }
    this.diag = { ...this.diag, artifactsAvailable: true };

    this.diag = { ...this.diag, stage: 'loading-runtime', subStatus: 'Loading WebLLM module' };

    let CreateMLCEngine: CreateMLCEngineFn;
    try {
      const webllm = await import('@mlc-ai/web-llm');
      CreateMLCEngine = webllm.CreateMLCEngine as unknown as CreateMLCEngineFn;
    } catch (e) {
      const reason = `Failed to load web-llm runtime: ${e instanceof Error ? e.message : String(e)}`;
      this.diag = {
        ...this.diag,
        failureReason: reason,
        failureStage: 'loading-runtime',
        stage: 'failed',
      };
      throw new Error(reason);
    }

    this.diag = { ...this.diag, stage: 'downloading-model', subStatus: 'Downloading MLC model' };
    try {
      this.engine = await CreateMLCEngine(target.artifacts.mlcModelId, {
        appConfig: {
          model_list: [
            {
              model: target.artifacts.modelUrl,
              model_id: target.artifacts.mlcModelId,
              model_lib: target.artifacts.modelLibUrl,
            },
          ],
        },
        initProgressCallback: (report) => {
          this.diag = { ...this.diag, downloadProgress: report.progress };
        },
      });
    } catch (e) {
      const reason = `Runtime init failed: ${e instanceof Error ? e.message : String(e)}`;
      this.diag = {
        ...this.diag,
        failureReason: reason,
        failureStage: 'downloading-model',
        stage: 'failed',
      };
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
