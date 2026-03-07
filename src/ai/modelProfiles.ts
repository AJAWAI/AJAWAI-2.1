export interface ModelProfile {
  id: string;
  name: string;
  sizeBytes: number;
  minMemoryGB: number;
  requiresWebGPU: boolean;
  description: string;
}

export const STEP_MODEL: ModelProfile = {
  id: 'step-3-vl-10b',
  name: 'STEP-3-VL-10B',
  sizeBytes: 10_000_000_000,
  minMemoryGB: 8,
  requiresWebGPU: true,
  description: 'STEP-3-VL-10B — the sole LLM for AJAWAI 2.1',
};

export function getModelProfile(id: string): ModelProfile | undefined {
  return id === STEP_MODEL.id ? STEP_MODEL : undefined;
}
