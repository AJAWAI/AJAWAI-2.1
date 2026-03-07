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

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error' | 'not-loaded';

export interface ModelInfo {
  name: string;
  status: ModelStatus;
  sizeBytes: number | null;
  loadTimeMs: number | null;
}

export interface MemoryEntry {
  id: string;
  conversationId: string;
  summary: string;
  timestamp: number;
}

export interface Settings {
  theme: 'light';
  showDebugPanel: boolean;
  maxContextTokens: number;
  modelId: string;
}

export interface PipelineMetrics {
  promptTokens: number;
  generationLatencyMs: number | null;
  memoryRetrievalMs: number | null;
  totalLatencyMs: number | null;
}
