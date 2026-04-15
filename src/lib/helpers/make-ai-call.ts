import { generateText } from 'ai';
import { anthropic } from '../model/anthropic.js';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiResponse {
  content: Array<{ text: string }>;
}

async function makeAiCall(model: string, messages: AiMessage[], maxTokens: number = 1024): Promise<AiResponse> {
  const result = await generateText({
    model: anthropic(model),
    messages,
    maxOutputTokens: maxTokens,
  });

  return { content: [{ text: result.text }] };
}

export default makeAiCall;
