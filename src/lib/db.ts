import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Conversation, MemoryEntry } from './types';

interface AjawaiDB extends DBSchema {
  conversations: {
    key: string;
    value: Conversation;
    indexes: { 'by-updated': number };
  };
  memory: {
    key: string;
    value: MemoryEntry;
    indexes: { 'by-conversation': string };
  };
}

let dbPromise: Promise<IDBPDatabase<AjawaiDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<AjawaiDB>('ajawai-db', 1, {
      upgrade(db) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
        convStore.createIndex('by-updated', 'updatedAt');

        const memStore = db.createObjectStore('memory', { keyPath: 'id' });
        memStore.createIndex('by-conversation', 'conversationId');
      },
    });
  }
  return dbPromise;
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const db = await getDB();
  await db.put('conversations', conversation);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const db = await getDB();
  return db.get('conversations', id);
}

export async function getAllConversations(): Promise<Conversation[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('conversations', 'by-updated');
  return all.reverse();
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('conversations', id);
}

export async function saveMemoryEntry(entry: MemoryEntry): Promise<void> {
  const db = await getDB();
  await db.put('memory', entry);
}

export async function getMemoryForConversation(conversationId: string): Promise<MemoryEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('memory', 'by-conversation', conversationId);
}
