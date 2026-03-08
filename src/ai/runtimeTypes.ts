import type { ModelProfile } from './modelProfiles';

export type RuntimeId = 'webllm' | 'wllama';

export type ConnectionStage =
  | 'idle'
  | 'selecting-model'
  | 'checking-browser'
  | 'checking-storage'
  | 'checking-artifacts'
  | 'loading-runtime'
  | 'downloading-model'
  | 'loading-model'
  | 'ready'
  | 'failed';

export type FailureCategory =
  | 'unsupported_browser'
  | 'insufficient_storage'
  | 'artifact_missing'
  | 'runtime_import_failed'
  | 'wasm_init_failed'
  | 'memory_load_failed'
  | 'initialization_timeout'
  | 'unknown_runtime_failure';

export interface ConnectionDiagnostics {
  runtimePath: RuntimeId;
  stage: ConnectionStage;
  subStatus: string;
  browserCompatible: boolean | null;
  artifactsAvailable: boolean | null;
  memoryEstimateGB: number | null;
  memorySufficient: boolean | null;
  failureReason: string | null;
  failureStage: ConnectionStage | null;
  failureCategory: FailureCategory | null;
  downloadProgress: number;
  downloadedBytes: number;
  totalBytes: number;
  elapsedMs: number;
  activeProfile: ModelProfile | null;
  fallbackTriggered: boolean;
  fallbackReason: string | null;
  quotaAvailableGB: number | null;
  loadSource: 'network' | 'cache' | 'unknown';
}

export function emptyDiagnostics(runtimeId: RuntimeId): ConnectionDiagnostics {
  return {
    runtimePath: runtimeId,
    stage: 'idle',
    subStatus: '',
    browserCompatible: null,
    artifactsAvailable: null,
    memoryEstimateGB: null,
    memorySufficient: null,
    failureReason: null,
    failureStage: null,
    failureCategory: null,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    elapsedMs: 0,
    activeProfile: null,
    fallbackTriggered: false,
    fallbackReason: null,
    quotaAvailableGB: null,
    loadSource: 'unknown',
  };
}

export interface RuntimeBackend {
  readonly id: RuntimeId;
  initialize(profile: ModelProfile): Promise<void>;
  generate(prompt: string, maxTokens: number, temperature: number): Promise<string>;
  unload(): Promise<void>;
  getDiagnostics(): ConnectionDiagnostics;
}
