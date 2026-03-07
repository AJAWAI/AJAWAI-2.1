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
    indexes: {
      'by-conversation': string;
      'by-category': string;
      'by-timestamp': number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<AjawaiDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<AjawaiDB>('ajawai-db', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('by-updated', 'updatedAt');
        }

        if (oldVersion < 2) {
          if (db.objectStoreNames.contains('memory')) {
            db.deleteObjectStore('memory');
          }
          const memStore = db.createObjectStore('memory', { keyPath: 'id' });
          memStore.createIndex('by-conversation', 'conversationId');
          memStore.createIndex('by-category', 'category');
          memStore.createIndex('by-timestamp', 'timestamp');
        }
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

export async function getAllMemory(): Promise<MemoryEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('memory', 'by-timestamp');
  return all.reverse();
}

export async function getMemoryByCategory(category: string): Promise<MemoryEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('memory', 'by-category', category);
}
