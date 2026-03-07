import { create } from 'zustand';
import type { MemoryEntry } from '../lib/types';
import { getMemoryForConversation } from '../lib/db';

interface MemoryState {
  entries: MemoryEntry[];
  loading: boolean;
  loadMemory: (conversationId: string) => Promise<void>;
  clearEntries: () => void;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  entries: [],
  loading: false,

  loadMemory: async (conversationId: string) => {
    set({ loading: true });
    const entries = await getMemoryForConversation(conversationId);
    set({ entries, loading: false });
  },

  clearEntries: () => {
    set({ entries: [], loading: false });
  },
}));
