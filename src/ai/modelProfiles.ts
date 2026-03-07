import type { RuntimeId } from './runtimeTypes';

export interface MlcArtifacts {
  mlcModelId: string;
  modelWeightsUrl: string;
  modelLibWasmUrl: string;
  mlcChatConfigUrl: string;
  tokenizerUrl: string;
}

export interface ArtifactConfig {
  mlc: MlcArtifacts | null;
  ggufUrl: string | null;
}

export type ArtifactStatus = 'not-configured' | 'configured' | 'validated' | 'invalid';

export function getArtifactStatus(artifacts: ArtifactConfig | null, runtime: RuntimeId): ArtifactStatus {
  if (!artifacts) return 'not-configured';
  if (runtime === 'webllm') {
    if (!artifacts.mlc) return 'not-configured';
    const m = artifacts.mlc;
    if (!m.modelWeightsUrl || !m.modelLibWasmUrl || !m.mlcChatConfigUrl || !m.tokenizerUrl) {
      return 'invalid';
    }
    return 'configured';
  }
  if (runtime === 'wllama') {
    return artifacts.ggufUrl ? 'configured' : 'not-configured';
  }
  return 'not-configured';
}

export const MLC_EXPECTED_FILES = [
  'ndarray-cache.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'mlc-chat-config.json',
  '*.wasm (model library)',
  'params_shard_*.bin (weight shards)',
] as const;

export interface DeploymentTarget {
  id: string;
  modelName: string;
  quantization: 'Q4' | 'Q5' | 'Q8' | 'FP16';
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
  id: 'step-3-vl-10b-q4',
  modelName: 'STEP-3-VL-10B',
  quantization: 'Q4',
  contextWindow: 1024,
  estimatedWeightSizeGB: 5.5,
  estimatedRuntimeMemoryGB: 6.5,
  kvCacheSizeGB: 0.5,
  maxOutputTokens: 256,
  recommendedDeviceTier: '8 GB+ RAM, modern GPU',
  browserSupportNotes: 'Requires WebGPU (Chrome 113+). WASM fallback planned.',
  preferredRuntime: 'webllm',
  artifacts: null,
};
