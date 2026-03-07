import type { Message, PipelineMetrics } from '../lib/types';
import { retrieveRelevantMemory, storeMemory } from './memory';
import { buildPrompt } from './promptBuilder';
import { runStepInference, MOBILE_GENERATION_CONFIG } from './browserLocalAdapter';
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
          memoryRetrievalMs: 0,
          totalLatencyMs: performance.now() - totalStart,
          generationSource: 'unavailable',
          memoryItemsInjected: 0,
          recentTurnsIncluded: 0,
          budgetUsage: { system: 0, memory: 0, history: 0, currentMessage: 0, total: 0 },
          secondPassUsed: false,
        },
      };
    }
  }

  const memStart = performance.now();
  const memoryEntries = await retrieveRelevantMemory(conversationId, lastMessage.content);
  const memoryRetrievalMs = performance.now() - memStart;

  const prompt = buildPrompt(messages, memoryEntries);

  const modelState = getModelManagerState();
  void modelState;

  const result = await runStepInference(prompt.text, MOBILE_GENERATION_CONFIG);

  await storeMemory(conversationId, messages);

  return {
    response: result.text,
    metrics: {
      promptTokens: prompt.tokenEstimate,
      generationLatencyMs: result.latencyMs,
      memoryRetrievalMs,
      totalLatencyMs: performance.now() - totalStart,
      generationSource: result.source,
      memoryItemsInjected: prompt.memoryItemsIncluded,
      recentTurnsIncluded: prompt.turnsIncluded,
      budgetUsage: prompt.budget,
      secondPassUsed: false,
    },
  };
}
