import { STEP_TARGET } from './modelProfiles';
import type { RuntimeBackend, ConnectionDiagnostics } from './runtimeTypes';
import { emptyDiagnostics } from './runtimeTypes';
import { WebLLMRuntime } from './webllmRuntime';

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

let activeRuntime: RuntimeBackend | null = null;

export function createRuntime(): RuntimeBackend {
  return new WebLLMRuntime();
}

export function getActiveRuntime(): RuntimeBackend | null {
  return activeRuntime;
}

export function setActiveRuntime(runtime: RuntimeBackend | null): void {
  activeRuntime = runtime;
}

export function getRuntimeDiagnostics(): ConnectionDiagnostics {
  return activeRuntime?.getDiagnostics() ?? emptyDiagnostics('webllm');
}

export async function runStepInference(
  prompt: string,
  config: GenerationConfig = MOBILE_GENERATION_CONFIG,
): Promise<InferenceResult> {
  const start = performance.now();

  if (!activeRuntime || activeRuntime.getDiagnostics().stage !== 'ready') {
    const diag = getRuntimeDiagnostics();
    const reason = diag.failureReason
      ? `Connection failed at ${diag.failureStage}: ${diag.failureReason}`
      : 'STEP runtime not connected. Use the debug panel to attempt connection.';

    return {
      text: reason,
      latencyMs: performance.now() - start,
      source: 'unavailable',
    };
  }

  try {
    const text = await activeRuntime.generate(prompt, config.maxOutputTokens, config.temperature);
    return {
      text,
      latencyMs: performance.now() - start,
      source: 'step',
    };
  } catch (e) {
    return {
      text: `Generation error: ${e instanceof Error ? e.message : String(e)}`,
      latencyMs: performance.now() - start,
      source: 'unavailable',
    };
  }
}
