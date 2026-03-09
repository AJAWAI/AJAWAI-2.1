export interface ModelEntry {
  modelId: string;
  hfId: string;
  displayName: string;
  role: 'reasoning' | 'vision' | 'multimodal';
  quantization: string;
  dtype: string;
  device: 'webgpu' | 'wasm' | 'cpu';
  estimatedRAM_GB: number;
  downloadSize_GB: number;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  cacheVersion: number;
}

export const PHI35_Q4: ModelEntry = {
  modelId: 'phi35-mini-q4',
  hfId: 'onnx-community/Phi-3.5-mini-instruct-onnx-web',
  displayName: 'Phi-3.5 Mini',
  role: 'reasoning',
  quantization: 'Q4F16',
  dtype: 'q4f16',
  device: 'webgpu',
  estimatedRAM_GB: 2.5,
  downloadSize_GB: 2.3,
  contextWindow: 512,
  maxOutputTokens: 128,
  supportsVision: false,
  cacheVersion: 2,
};

export const MOONDREAM_Q4: ModelEntry = {
  modelId: 'moondream2-q4',
  hfId: 'Xenova/moondream2',
  displayName: 'Moondream2',
  role: 'vision',
  quantization: 'Q4F16',
  dtype: 'q4f16',
  device: 'webgpu',
  estimatedRAM_GB: 1.5,
  downloadSize_GB: 1.2,
  contextWindow: 512,
  maxOutputTokens: 128,
  supportsVision: true,
  cacheVersion: 1,
};

export const STEP_Q4: ModelEntry = {
  modelId: 'step-3-vl-10b-q4',
  hfId: 'stepfun-ai/Step3-VL-10B',
  displayName: 'STEP-3-VL-10B',
  role: 'multimodal',
  quantization: 'Q4',
  dtype: 'q4',
  device: 'webgpu',
  estimatedRAM_GB: 6.0,
  downloadSize_GB: 5.5,
  contextWindow: 1024,
  maxOutputTokens: 256,
  supportsVision: true,
  cacheVersion: 1,
};

export const ALL_MODELS = [STEP_Q4, PHI35_Q4, MOONDREAM_Q4] as const;
