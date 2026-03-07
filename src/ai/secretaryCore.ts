import type { Message, PipelineMetrics } from '../lib/types';
import { retrieveMemory, storeMemory } from './memory';
import { buildPrompt } from './promptBuilder';
import { runStepInference } from './browserLocalAdapter';
import { analyzeIntent } from './picoClaw';
import { routeToolCall } from './toolRouter';
import { getModelManagerState } from './modelManager';

export interface PipelineResult {
  response: string;
  metrics: PipelineMetrics;
}

export async function runPipeline(
  conversationId: string,
  messages: Message[],
): Promise<PipelineResult> {
  const totalStart = performance.now();

  const memStart = performance.now();
  const memoryEntries = await retrieveMemory(conversationId);
  const memoryRetrievalMs = performance.now() - memStart;

  const lastMessage = messages[messages.length - 1];
  const intent = analyzeIntent(lastMessage.content);

  if (intent.shouldUseTool && intent.toolName && intent.toolInput) {
    const toolResult = await routeToolCall(intent.toolName, intent.toolInput);
    if (toolResult) {
      return {
        response: toolResult,
        metrics: {
          promptTokens: 0,
          generationLatencyMs: 0,
          memoryRetrievalMs,
          totalLatencyMs: performance.now() - totalStart,
          generationSource: 'unavailable',
        },
      };
    }
  }

  const modelState = getModelManagerState();
  const prompt = buildPrompt(messages, memoryEntries);

  if (modelState.status !== 'ready') {
    const result = await runStepInference(prompt.text);

    await storeMemory(conversationId, messages);

    return {
      response: result.text,
      metrics: {
        promptTokens: prompt.tokenEstimate,
        generationLatencyMs: result.latencyMs,
        memoryRetrievalMs,
        totalLatencyMs: performance.now() - totalStart,
        generationSource: result.source,
      },
    };
  }

  const result = await runStepInference(prompt.text);

  await storeMemory(conversationId, messages);

  return {
    response: result.text,
    metrics: {
      promptTokens: prompt.tokenEstimate,
      generationLatencyMs: result.latencyMs,
      memoryRetrievalMs,
      totalLatencyMs: performance.now() - totalStart,
      generationSource: result.source,
    },
  };
}
