import type { Message, MemoryEntry, PromptBudget } from '../lib/types';

const SYSTEM_PROMPT = 'You are AJAWAI, a concise AI assistant. Be brief and direct.';

const CONTEXT_WINDOW = 512;
const OUTPUT_RESERVE = 128;
const PROMPT_BUDGET = CONTEXT_WINDOW - OUTPUT_RESERVE;

const BUDGET_MEMORY_MAX = 60;
const BUDGET_CURRENT_MSG = 80;

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
  const parts: string[] = [SYSTEM_PROMPT];
  const systemTokens = estimateTokens(SYSTEM_PROMPT);

  const currentMsg = messages[messages.length - 1];
  const trimmed = currentMsg.content.slice(0, BUDGET_CURRENT_MSG * 3);
  const currentText = `User: ${trimmed}`;
  const currentTokens = Math.min(estimateTokens(currentText), BUDGET_CURRENT_MSG);

  let memoryTokens = 0;
  const injected: string[] = [];
  for (const entry of memoryEntries) {
    const line = `[${entry.category}] ${entry.summary.slice(0, 60)}`;
    const t = estimateTokens(line);
    if (memoryTokens + t > BUDGET_MEMORY_MAX) break;
    injected.push(line);
    memoryTokens += t;
  }

  const historyBudget = Math.max(0, PROMPT_BUDGET - systemTokens - memoryTokens - currentTokens - 2);
  let historyTokens = 0;
  const turns: string[] = [];
  for (const msg of messages.slice(0, -1).reverse()) {
    const line = `${msg.role === 'user' ? 'U' : 'A'}: ${msg.content.slice(0, 80)}`;
    const t = estimateTokens(line);
    if (historyTokens + t > historyBudget) break;
    turns.unshift(line);
    historyTokens += t;
  }

  if (injected.length > 0) parts.push(injected.join('\n'));
  if (turns.length > 0) parts.push(turns.join('\n'));
  parts.push(currentText);
  parts.push('A:');

  const text = parts.join('\n');
  const total = systemTokens + memoryTokens + historyTokens + currentTokens + 2;

  return {
    text,
    tokenEstimate: total,
    budget: { system: systemTokens, memory: memoryTokens, history: historyTokens, currentMessage: currentTokens, total },
    turnsIncluded: turns.length,
    memoryItemsIncluded: injected.length,
  };
}
