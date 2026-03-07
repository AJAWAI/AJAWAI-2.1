import { create } from 'zustand';
import type { Conversation, Message, PipelineMetrics } from '../lib/types';
import { generateId } from '../lib/utils';
import { saveConversation, getAllConversations, deleteConversation as dbDeleteConversation } from '../lib/db';
import { runPipeline } from '../ai/secretaryCore';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isGenerating: boolean;
  lastMetrics: PipelineMetrics | null;

  loadConversations: () => Promise<void>;
  createConversation: () => string;
  setActiveConversation: (id: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isGenerating: false,
  lastMetrics: null,

  loadConversations: async () => {
    const conversations = await getAllConversations();
    set({ conversations });
    if (conversations.length > 0 && !get().activeConversationId) {
      set({ activeConversationId: conversations[0].id });
    }
  },

  createConversation: () => {
    const id = generateId();
    const conversation: Conversation = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({
      conversations: [conversation, ...s.conversations],
      activeConversationId: id,
    }));
    saveConversation(conversation);
    return id;
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
  },

  deleteConversation: async (id) => {
    await dbDeleteConversation(id);
    set((s) => {
      const remaining = s.conversations.filter((c) => c.id !== id);
      return {
        conversations: remaining,
        activeConversationId:
          s.activeConversationId === id
            ? remaining[0]?.id ?? null
            : s.activeConversationId,
      };
    });
  },

  sendMessage: async (content) => {
    const state = get();
    let convId = state.activeConversationId;

    if (!convId) {
      convId = get().createConversation();
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    set((s) => ({
      isGenerating: true,
      conversations: s.conversations.map((c) => {
        if (c.id !== convId) return c;
        const msgs = [...c.messages, userMessage];
        return {
          ...c,
          messages: msgs,
          title: c.messages.length === 0 ? content.slice(0, 40) : c.title,
          updatedAt: Date.now(),
        };
      }),
    }));

    const conv = get().conversations.find((c) => c.id === convId)!;
    await saveConversation(conv);

    try {
      const result = await runPipeline(convId, conv.messages);

      const aiMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: result.response,
        timestamp: Date.now(),
      };

      set((s) => ({
        isGenerating: false,
        lastMetrics: result.metrics,
        conversations: s.conversations.map((c) => {
          if (c.id !== convId) return c;
          return {
            ...c,
            messages: [...c.messages, aiMessage],
            updatedAt: Date.now(),
          };
        }),
      }));

      const updatedConv = get().conversations.find((c) => c.id === convId)!;
      await saveConversation(updatedConv);
    } catch {
      set({ isGenerating: false });
    }
  },
}));
