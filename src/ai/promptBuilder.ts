import type { Message, MemoryEntry } from '../lib/types';

const SYSTEM_PROMPT = `You are AJAWAI 2.1, powered by STEP-3-VL-10B. You are a helpful, concise, and friendly AI assistant running locally on the user's device. Be direct and efficient in your responses.`;

export interface BuiltPrompt {
  text: string;
  tokenEstimate: number;
}

export function buildPrompt(
  messages: Message[],
  memoryEntries: MemoryEntry[],
  maxTokens: number = 2048,
): BuiltPrompt {
  const parts: string[] = [SYSTEM_PROMPT];

  if (memoryEntries.length > 0) {
    const memorySummary = memoryEntries
      .slice(-3)
      .map((e) => e.summary)
      .join('\n');
    parts.push(`[Context from memory]\n${memorySummary}`);
  }

  const recentMessages = messages.slice(-10);
  for (const msg of recentMessages) {
    const prefix = msg.role === 'user' ? 'User' : 'Assistant';
    parts.push(`${prefix}: ${msg.content}`);
  }

  parts.push('Assistant:');

  const text = parts.join('\n\n');
  const tokenEstimate = Math.ceil(text.length / 4);

  const trimmedText = tokenEstimate > maxTokens
    ? text.slice(-(maxTokens * 4))
    : text;

  return {
    text: trimmedText,
    tokenEstimate: Math.min(tokenEstimate, maxTokens),
  };
}
