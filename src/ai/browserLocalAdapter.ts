export interface GenerationConfig {
  maxOutputTokens: number;
  temperature: number;
}

export const MOBILE_GENERATION_CONFIG: GenerationConfig = {
  maxOutputTokens: 128,
  temperature: 0.7,
};

export interface InferenceResult {
  text: string;
  latencyMs: number;
  source: 'model' | 'unavailable';
}

import { generate, getOrchestratorState } from './runtime/modelOrchestrator';

export async function runInference(
  prompt: string,
  config: GenerationConfig = MOBILE_GENERATION_CONFIG,
): Promise<InferenceResult> {
  const start = performance.now();
  const orch = getOrchestratorState();

  if (orch.status !== 'ready') {
    const reason = orch.error ?? 'Model not loaded. Open debug panel to connect.';
    return { text: reason, latencyMs: performance.now() - start, source: 'unavailable' };
  }

  try {
    const text = await generate(prompt, config.maxOutputTokens);
    return { text, latencyMs: performance.now() - start, source: 'model' };
  } catch (e) {
    return {
      text: `Generation error: ${e instanceof Error ? e.message : String(e)}`,
      latencyMs: performance.now() - start, source: 'unavailable',
    };
  }
}
