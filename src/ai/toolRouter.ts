export interface ToolDefinition {
  name: string;
  description: string;
  execute: (input: string) => Promise<string>;
}

const tools: Map<string, ToolDefinition> = new Map();

export function registerTool(tool: ToolDefinition): void {
  tools.set(tool.name, tool);
}

export function getAvailableTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

export async function routeToolCall(
  toolName: string,
  input: string,
): Promise<string | null> {
  const tool = tools.get(toolName);
  if (!tool) return null;
  return tool.execute(input);
}

registerTool({
  name: 'echo',
  description: 'Echoes the input back (test tool)',
  execute: async (input) => `Echo: ${input}`,
});
