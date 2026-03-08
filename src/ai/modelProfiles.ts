import type { RuntimeId } from './runtimeTypes';

export interface ArtifactConfig {
  modelUrl: string;
  modelLibUrl: string;
  mlcModelId: string;
  ggufUrl: string | null;
  tokenizerUrl: string | null;
  configUrl: string | null;
}

export interface DeploymentTarget {
  id: string;
  modelName: string;
  quantization: string;
  contextWindow: number;
  estimatedWeightSizeGB: number;
  estimatedRuntimeMemoryGB: number;
  kvCacheSizeGB: number;
  maxOutputTokens: number;
  recommendedDeviceTier: string;
  browserSupportNotes: string;
  preferredRuntime: RuntimeId;
  artifacts: ArtifactConfig | null;
}

export const STEP_TARGET: DeploymentTarget = {
  id: 'step-3-vl-10b-iq3xs',
  modelName: 'STEP-3-VL-10B',
  quantization: 'IQ3_XS',
  contextWindow: 512,
  estimatedWeightSizeGB: 3.6,
  estimatedRuntimeMemoryGB: 4.5,
  kvCacheSizeGB: 0.2,
  maxOutputTokens: 128,
  recommendedDeviceTier: '8 GB+ RAM',
  browserSupportNotes: 'WASM (all browsers). WebGPU optional.',
  preferredRuntime: 'wllama',
  artifacts: null,
};
