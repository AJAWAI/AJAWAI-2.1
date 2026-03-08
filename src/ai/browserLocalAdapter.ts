export interface GenerationConfig {
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  repeatPenalty: number;
}

export const MOBILE_GENERATION_CONFIG: GenerationConfig = {
  maxOutputTokens: 128,
  temperature: 0.7,
  topP: 0.9,
  repeatPenalty: 1.1,
};

export interface InferenceResult {
  text: string;
  latencyMs: number;
  source: 'model' | 'unavailable';
}

import { getActiveRuntime, getModelManagerState } from './modelManager';

export async function runInference(
  prompt: string,
  config: GenerationConfig = MOBILE_GENERATION_CONFIG,
): Promise<InferenceResult> {
  const start = performance.now();
  const runtime = getActiveRuntime();
  const mgrState = getModelManagerState();

  if (!runtime || mgrState.status !== 'ready') {
    const reason = mgrState.error
      ? `Connection failed: ${mgrState.error}`
      : 'Model not loaded. Open debug panel to connect.';
    return { text: reason, latencyMs: performance.now() - start, source: 'unavailable' };
  }

  try {
    const text = await runtime.generate(prompt, config.maxOutputTokens, config.temperature);
    return { text, latencyMs: performance.now() - start, source: 'model' };
  } catch (e) {
    return {
      text: `Generation error: ${e instanceof Error ? e.message : String(e)}`,
      latencyMs: performance.now() - start,
      source: 'unavailable',
    };
  }
}
