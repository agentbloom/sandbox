import { generateText } from 'ai';
import { qwen } from '../model/qwen.js';

export interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface QwenResponse {
  content: Array<{ text: string }>;
}

async function makeAiCall(model: string, messages: QwenMessage[], maxTokens: number = 1024): Promise<QwenResponse> {
  const result = await generateText({
    model: qwen(model),
    messages,
    maxOutputTokens: maxTokens,
  });

  return { content: [{ text: result.text }] };
}

export default makeAiCall;
