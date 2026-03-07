export interface InferenceResult {
  text: string;
  latencyMs: number;
}

export async function runLocalInference(prompt: string): Promise<InferenceResult> {
  const start = performance.now();

  // Will use prompt for real inference once a local model is loaded
  void prompt;

  await new Promise((r) => setTimeout(r, 300 + Math.random() * 700));

  const responses = [
    "I'm AJAWAI, your local AI assistant. I'm currently running in placeholder mode — once a local model is loaded, I'll provide real inference responses. How can I help you?",
    "That's an interesting question! In placeholder mode, I can only give simulated responses. Load a local model to enable full AI capabilities.",
    "I appreciate your message. Right now I'm operating without a loaded model. Tap 'Load Local Model' in the debug panel to enable real inference.",
    "Thanks for chatting with me! I'm AJAWAI 2.1, running in demo mode. My full capabilities activate once a local model is loaded on your device.",
    "Great question! I'm currently in placeholder mode. When a local model is loaded, I'll be able to give you real, contextual responses powered entirely by your device.",
  ];

  const text = responses[Math.floor(Math.random() * responses.length)];
  const latencyMs = performance.now() - start;

  return { text, latencyMs };
}
