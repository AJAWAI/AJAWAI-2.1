import type { Message, MemoryEntry, MemoryCategory } from '../lib/types';
import { getMemoryForConversation, getAllMemory, saveMemoryEntry } from '../lib/db';
import { generateId } from '../lib/utils';

const MAX_RETRIEVED = 4;

function classifyCategory(text: string): MemoryCategory {
  const lower = text.toLowerCase();

  if (/\b(prefer|like|dislike|favorite|hate|love|style)\b/.test(lower))
    return 'preference';
  if (/\b(my name|i am|i'm|i live|born|age|family)\b/.test(lower))
    return 'personal';
  if (/\b(goal|plan|want to|aim|objective|target|deadline)\b/.test(lower))
    return 'goal';
  if (/\b(write|tone|format|draft|essay|blog|article|email)\b/.test(lower))
    return 'writing';
  if (/\b(project|build|app|code|feature|deploy|repo|sprint)\b/.test(lower))
    return 'project';
  if (/\b(company|client|revenue|meeting|team|budget|contract)\b/.test(lower))
    return 'business';

  return 'general';
}

function extractKeywords(text: string): string[] {
  const stops = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'that',
    'this', 'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they', 'me',
    'my', 'your', 'and', 'or', 'but', 'not', 'so', 'if', 'then', 'than',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stops.has(w))
    .slice(0, 10);
}

function scoreRelevance(entry: MemoryEntry, queryKeywords: string[]): number {
  let score = 0;

  const entryWords = new Set(entry.keywords);
  for (const kw of queryKeywords) {
    if (entryWords.has(kw)) score += 2;
  }

  if (entry.summary.toLowerCase().includes(queryKeywords.join(' '))) {
    score += 3;
  }

  const ageHours = (Date.now() - entry.timestamp) / 3_600_000;
  if (ageHours < 1) score += 2;
  else if (ageHours < 24) score += 1;

  const boostCategories: MemoryCategory[] = ['preference', 'personal', 'goal'];
  if (boostCategories.includes(entry.category)) score += 1;

  return score;
}

export async function retrieveRelevantMemory(
  conversationId: string,
  currentMessage: string,
): Promise<MemoryEntry[]> {
  const [conversationMemory, globalMemory] = await Promise.all([
    getMemoryForConversation(conversationId),
    getAllMemory(),
  ]);

  const seen = new Set(conversationMemory.map((e) => e.id));
  const crossConversation = globalMemory.filter((e) => !seen.has(e.id));

  const allCandidates = [...conversationMemory, ...crossConversation];
  if (allCandidates.length === 0) return [];

  const queryKeywords = extractKeywords(currentMessage);

  const scored = allCandidates
    .map((entry) => ({ entry, score: scoreRelevance(entry, queryKeywords) }))
    .sort((a, b) => b.score - a.score);

  return scored
    .slice(0, MAX_RETRIEVED)
    .filter((s) => s.score > 0)
    .map((s) => s.entry);
}

export async function storeMemory(
  conversationId: string,
  messages: Message[],
): Promise<void> {
  if (messages.length < 2) return;

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  if (!lastUser) return;

  const combinedText = lastAssistant
    ? `${lastUser.content} ${lastAssistant.content}`
    : lastUser.content;

  const category = classifyCategory(combinedText);
  const keywords = extractKeywords(combinedText);
  const summary = lastUser.content.slice(0, 120);

  const entry: MemoryEntry = {
    id: generateId(),
    conversationId,
    category,
    summary,
    keywords,
    timestamp: Date.now(),
  };

  await saveMemoryEntry(entry);
}
