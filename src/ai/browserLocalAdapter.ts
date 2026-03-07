import { STEP_TARGET } from './modelProfiles';

export interface GenerationConfig {
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  repeatPenalty: number;
}

export const MOBILE_GENERATION_CONFIG: GenerationConfig = {
  maxOutputTokens: STEP_TARGET.maxOutputTokens,
  temperature: 0.7,
  topP: 0.9,
  repeatPenalty: 1.1,
};

export interface InferenceResult {
  text: string;
  latencyMs: number;
  source: 'step' | 'unavailable';
}

export const STEP_RUNTIME_CONNECTED = false;

export async function runStepInference(
  prompt: string,
  config: GenerationConfig = MOBILE_GENERATION_CONFIG,
): Promise<InferenceResult> {
  const start = performance.now();

  if (!STEP_RUNTIME_CONNECTED) {
    void prompt;
    void config;
    return {
      text: `STEP-3-VL-10B (${STEP_TARGET.quantization}, ${STEP_TARGET.contextWindow} ctx) runtime is not connected yet. The browser adapter is under development.`,
      latencyMs: performance.now() - start,
      source: 'unavailable',
    };
  }

  void prompt;
  return {
    text: '',
    latencyMs: performance.now() - start,
    source: 'step',
  };
}
