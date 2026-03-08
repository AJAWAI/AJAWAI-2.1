import type { DeviceTier } from './deviceCapability';

export interface ModelProfile {
  id: string;
  displayName: string;
  tier: DeviceTier;
  quantization: string;
  contextWindow: number;
  maxOutputTokens: number;
  fileSizeBytes: number;
  estimatedRuntimeGB: number;
  modelUrl: string;
  mmprojUrl: string | null;
  mmprojSizeBytes: number;
}

const HF_STEP = 'https://huggingface.co/seanbailey518/Step3-VL-10B-GGUF/resolve/main';
const HF_QWEN4 = 'https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF/resolve/main';
const HF_QWEN2 = 'https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/main';

export const MODEL_PROFILES: Record<DeviceTier, ModelProfile> = {
  high: {
    id: 'step-3-vl-10b-iq3xs',
    displayName: 'STEP-3-VL-10B',
    tier: 'high',
    quantization: 'IQ3_XS',
    contextWindow: 512,
    maxOutputTokens: 128,
    fileSizeBytes: 3_626_874_688,
    estimatedRuntimeGB: 4.0,
    modelUrl: `${HF_STEP}/Step3-VL-10B-IQ3_XS.gguf`,
    mmprojUrl: null,
    mmprojSizeBytes: 0,
  },
  medium: {
    id: 'qwen3-vl-4b-q4km',
    displayName: 'Qwen3-VL-4B',
    tier: 'medium',
    quantization: 'Q4_K_M',
    contextWindow: 512,
    maxOutputTokens: 128,
    fileSizeBytes: 2_500_000_000,
    estimatedRuntimeGB: 3.0,
    modelUrl: `${HF_QWEN4}/Qwen3VL-4B-Instruct-Q4_K_M.gguf`,
    mmprojUrl: `${HF_QWEN4}/mmproj-Qwen3VL-4B-Instruct-F16.gguf`,
    mmprojSizeBytes: 840_000_000,
  },
  low: {
    id: 'qwen3-vl-2b-q4km',
    displayName: 'Qwen3-VL-2B',
    tier: 'low',
    quantization: 'Q4_K_M',
    contextWindow: 512,
    maxOutputTokens: 128,
    fileSizeBytes: 1_110_000_000,
    estimatedRuntimeGB: 1.6,
    modelUrl: `${HF_QWEN2}/Qwen3VL-2B-Instruct-Q4_K_M.gguf`,
    mmprojUrl: `${HF_QWEN2}/mmproj-Qwen3VL-2B-Instruct-F16.gguf`,
    mmprojSizeBytes: 820_000_000,
  },
};

export const FALLBACK_ORDER: DeviceTier[] = ['high', 'medium', 'low'];

export function getProfileForTier(tier: DeviceTier): ModelProfile {
  return MODEL_PROFILES[tier];
}

export function getFallbackTier(current: DeviceTier): DeviceTier | null {
  const idx = FALLBACK_ORDER.indexOf(current);
  if (idx < 0 || idx >= FALLBACK_ORDER.length - 1) return null;
  return FALLBACK_ORDER[idx + 1];
}
