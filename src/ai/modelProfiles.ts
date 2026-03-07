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
  requiresWebGPU: boolean;
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
  browserSupportNotes: 'Requires WebGPU (Chrome 113+). WASM fallback possible with reduced performance.',
  requiresWebGPU: true,
};
