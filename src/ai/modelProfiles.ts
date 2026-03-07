export interface ModelProfile {
  id: string;
  name: string;
  sizeBytes: number;
  minMemoryGB: number;
  requiresWebGPU: boolean;
  description: string;
}

export const MODEL_PROFILES: ModelProfile[] = [
  {
    id: 'tinyllama-1.1b',
    name: 'TinyLlama 1.1B',
    sizeBytes: 637_534_208,
    minMemoryGB: 2,
    requiresWebGPU: false,
    description: 'Lightweight model suitable for basic tasks',
  },
  {
    id: 'phi-2',
    name: 'Phi-2 2.7B',
    sizeBytes: 1_500_000_000,
    minMemoryGB: 4,
    requiresWebGPU: true,
    description: 'More capable model requiring WebGPU',
  },
];

export function getDefaultModelId(): string {
  return MODEL_PROFILES[0].id;
}

export function getModelProfile(id: string): ModelProfile | undefined {
  return MODEL_PROFILES.find((m) => m.id === id);
}
