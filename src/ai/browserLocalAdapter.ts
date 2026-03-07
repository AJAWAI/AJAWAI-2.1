export interface InferenceResult {
  text: string;
  latencyMs: number;
  source: 'step' | 'unavailable';
}

export const STEP_RUNTIME_CONNECTED = false;

export async function runStepInference(prompt: string): Promise<InferenceResult> {
  const start = performance.now();

  if (!STEP_RUNTIME_CONNECTED) {
    void prompt;
    return {
      text: 'STEP-3-VL-10B runtime is not connected yet. The browser adapter for STEP inference is under development. Your message has been recorded and will be processed once the runtime is available.',
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
