import type { ModelProfile } from './modelProfiles';
import {
  type RuntimeBackend,
  type ConnectionDiagnostics,
  emptyDiagnostics,
} from './runtimeTypes';

export class WebLLMRuntime implements RuntimeBackend {
  readonly id = 'webllm' as const;
  private diag: ConnectionDiagnostics = emptyDiagnostics('webllm');

  getDiagnostics(): ConnectionDiagnostics { return { ...this.diag }; }

  async initialize(_profile: ModelProfile): Promise<void> {
    void _profile;
    this.diag = {
      ...this.diag, stage: 'failed', failureStage: 'checking-artifacts',
      failureCategory: 'artifact_missing',
      failureReason: 'WebLLM/MLC artifacts not available. Use Wllama runtime instead.',
      subStatus: 'MLC artifacts not published',
    };
    throw new Error(this.diag.failureReason || 'WebLLM not available');
  }

  async generate(): Promise<string> { throw new Error('WebLLM not available'); }
  async unload(): Promise<void> { this.diag = emptyDiagnostics('webllm'); }
}
