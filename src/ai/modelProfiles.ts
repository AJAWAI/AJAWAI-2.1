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
  artifacts: {
    modelUrl: 'https://huggingface.co/stepfun-ai/STEP-3-VL-10B-MLC-Q4/resolve/main/',
    modelLibUrl: 'https://huggingface.co/stepfun-ai/STEP-3-VL-10B-MLC-Q4/resolve/main/step-3-vl-10b-q4.wasm',
    mlcModelId: 'step-3-vl-10b-q4',
    ggufUrl: null,
    tokenizerUrl: 'https://huggingface.co/stepfun-ai/STEP-3-VL-10B-MLC-Q4/resolve/main/tokenizer.json',
    configUrl: 'https://huggingface.co/stepfun-ai/STEP-3-VL-10B-MLC-Q4/resolve/main/mlc-chat-config.json',
  },
};
