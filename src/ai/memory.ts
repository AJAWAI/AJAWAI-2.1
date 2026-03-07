import type { Message, MemoryEntry } from '../lib/types';
import { getMemoryForConversation, saveMemoryEntry } from '../lib/db';
import { generateId } from '../lib/utils';

export async function retrieveMemory(conversationId: string): Promise<MemoryEntry[]> {
  return getMemoryForConversation(conversationId);
}

export async function storeMemory(
  conversationId: string,
  messages: Message[],
): Promise<void> {
  if (messages.length < 4) return;

  const lastMessages = messages.slice(-4);
  const summary = lastMessages
    .map((m) => `${m.role}: ${m.content.slice(0, 80)}`)
    .join(' | ');

  const entry: MemoryEntry = {
    id: generateId(),
    conversationId,
    summary,
    timestamp: Date.now(),
  };

  await saveMemoryEntry(entry);
}
