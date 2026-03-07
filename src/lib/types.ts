export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface DeviceCapabilities {
  webgpu: boolean;
  wasm: boolean;
  sharedArrayBuffer: boolean;
  deviceMemory: number | null;
  hardwareConcurrency: number;
  gpu: string | null;
}

export type ModelStatus =
  | 'not-loaded'
  | 'runtime-unavailable'
  | 'loading'
  | 'ready'
  | 'generating'
  | 'error';

export type MemoryCategory =
  | 'preference'
  | 'personal'
  | 'goal'
  | 'writing'
  | 'project'
  | 'business'
  | 'general';

export interface MemoryEntry {
  id: string;
  conversationId: string;
  category: MemoryCategory;
  summary: string;
  keywords: string[];
  timestamp: number;
}

export interface Settings {
  theme: 'light';
  showDebugPanel: boolean;
  maxContextTokens: number;
  modelId: string;
}

export interface PromptBudget {
  system: number;
  memory: number;
  history: number;
  currentMessage: number;
  total: number;
}

export interface PipelineMetrics {
  promptTokens: number;
  generationLatencyMs: number | null;
  memoryRetrievalMs: number | null;
  totalLatencyMs: number | null;
  generationSource: 'step' | 'unavailable';
  memoryItemsInjected: number;
  recentTurnsIncluded: number;
  budgetUsage: PromptBudget;
  secondPassUsed: boolean;
}
