import type { Message, MemoryEntry, PromptBudget } from '../lib/types';
import { STEP_TARGET } from './modelProfiles';

const SYSTEM_PROMPT = 'You are AJAWAI, a concise AI assistant. Be brief and direct.';

const CONTEXT_WINDOW = STEP_TARGET.contextWindow;
const OUTPUT_RESERVE = STEP_TARGET.maxOutputTokens;
const PROMPT_BUDGET = CONTEXT_WINDOW - OUTPUT_RESERVE;

const BUDGET_MEMORY_MAX = 40;
const BUDGET_CURRENT_MSG = 60;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export interface BuiltPrompt {
  text: string;
  tokenEstimate: number;
  budget: PromptBudget;
  turnsIncluded: number;
  memoryItemsIncluded: number;
}

export function buildPrompt(
  messages: Message[],
  memoryEntries: MemoryEntry[],
): BuiltPrompt {
  const parts: string[] = [];

  parts.push(SYSTEM_PROMPT);
  const systemTokens = estimateTokens(SYSTEM_PROMPT);

  const currentMsg = messages[messages.length - 1];
  const maxChars = BUDGET_CURRENT_MSG * 3;
  const trimmedContent = currentMsg.content.length > maxChars
    ? currentMsg.content.slice(0, maxChars)
    : currentMsg.content;
  const currentText = `User: ${trimmedContent}`;
  const currentTokens = Math.min(estimateTokens(currentText), BUDGET_CURRENT_MSG);

  let memoryTokens = 0;
  const injectedMemory: string[] = [];
  for (const entry of memoryEntries) {
    const line = `[${entry.category}] ${entry.summary.slice(0, 60)}`;
    const lineTokens = estimateTokens(line);
    if (memoryTokens + lineTokens > BUDGET_MEMORY_MAX) break;
    injectedMemory.push(line);
    memoryTokens += lineTokens;
  }

  const usedSoFar = systemTokens + memoryTokens + currentTokens + 2;
  const historyBudget = Math.max(0, PROMPT_BUDGET - usedSoFar);

  let historyTokens = 0;
  const historyTurns: string[] = [];
  const olderMessages = messages.slice(0, -1).reverse();

  for (const msg of olderMessages) {
    const prefix = msg.role === 'user' ? 'U' : 'A';
    const content = msg.content.slice(0, 80);
    const line = `${prefix}: ${content}`;
    const lineTokens = estimateTokens(line);
    if (historyTokens + lineTokens > historyBudget) break;
    historyTurns.unshift(line);
    historyTokens += lineTokens;
  }

  if (injectedMemory.length > 0) {
    parts.push(injectedMemory.join('\n'));
  }

  if (historyTurns.length > 0) {
    parts.push(historyTurns.join('\n'));
  }

  parts.push(currentText);
  parts.push('A:');

  const text = parts.join('\n');
  const totalTokens = systemTokens + memoryTokens + historyTokens + currentTokens + 2;

  return {
    text,
    tokenEstimate: totalTokens,
    budget: {
      system: systemTokens,
      memory: memoryTokens,
      history: historyTokens,
      currentMessage: currentTokens,
      total: totalTokens,
    },
    turnsIncluded: historyTurns.length,
    memoryItemsIncluded: injectedMemory.length,
  };
}
