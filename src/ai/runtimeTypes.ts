import type { DeploymentTarget } from './modelProfiles';

export type RuntimeId = 'webllm' | 'wllama';

export type ConnectionStage =
  | 'idle'
  | 'checking-browser'
  | 'checking-artifacts'
  | 'checking-memory'
  | 'downloading'
  | 'initializing'
  | 'ready'
  | 'failed';

export interface ConnectionDiagnostics {
  runtimePath: RuntimeId;
  stage: ConnectionStage;
  browserCompatible: boolean | null;
  artifactsAvailable: boolean | null;
  memoryEstimateGB: number | null;
  memorySufficient: boolean | null;
  failureReason: string | null;
  failureStage: ConnectionStage | null;
  downloadProgress: number;
}

export function emptyDiagnostics(runtimeId: RuntimeId): ConnectionDiagnostics {
  return {
    runtimePath: runtimeId,
    stage: 'idle',
    browserCompatible: null,
    artifactsAvailable: null,
    memoryEstimateGB: null,
    memorySufficient: null,
    failureReason: null,
    failureStage: null,
    downloadProgress: 0,
  };
}

export interface RuntimeBackend {
  readonly id: RuntimeId;
  checkBrowserSupport(): Promise<boolean>;
  initialize(target: DeploymentTarget): Promise<void>;
  generate(prompt: string, maxTokens: number, temperature: number): Promise<string>;
  unload(): Promise<void>;
  getDiagnostics(): ConnectionDiagnostics;
}
