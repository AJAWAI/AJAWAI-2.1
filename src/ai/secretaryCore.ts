import type { Message, PipelineMetrics } from '../lib/types';
import { retrieveMemory, storeMemory } from './memory';
import { buildPrompt } from './promptBuilder';
import { runLocalInference } from './browserLocalAdapter';
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
        },
      };
    }
  }

  const modelState = getModelManagerState();

  const prompt = buildPrompt(messages, memoryEntries);

  let response: string;
  let generationLatencyMs: number;

  if (modelState.status === 'ready') {
    const result = await runLocalInference(prompt.text);
    response = result.text;
    generationLatencyMs = result.latencyMs;
  } else {
    await new Promise((r) => setTimeout(r, 200));
    response =
      "I'm AJAWAI, your local AI assistant running in placeholder mode. Load a local model from the debug panel to enable real AI responses!";
    generationLatencyMs = 200;
  }

  await storeMemory(conversationId, messages);

  return {
    response,
    metrics: {
      promptTokens: prompt.tokenEstimate,
      generationLatencyMs,
      memoryRetrievalMs,
      totalLatencyMs: performance.now() - totalStart,
    },
  };
}
