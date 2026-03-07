import { getAvailableTools } from './toolRouter';

export interface PicoClawResult {
  shouldUseTool: boolean;
  toolName: string | null;
  toolInput: string | null;
}

export function analyzeIntent(userMessage: string): PicoClawResult {
  const lower = userMessage.toLowerCase();

  const availableTools = getAvailableTools();

  for (const tool of availableTools) {
    if (lower.includes(`use ${tool.name}`) || lower.includes(`run ${tool.name}`)) {
      return {
        shouldUseTool: true,
        toolName: tool.name,
        toolInput: userMessage,
      };
    }
  }

  return {
    shouldUseTool: false,
    toolName: null,
    toolInput: null,
  };
}
