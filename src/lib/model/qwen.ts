import { createOpenAI } from '@ai-sdk/openai';

if (!process.env.QWEN_BASE_URL) {
  throw new Error('QWEN_BASE_URL environment variable is not set');
}

const qwenProvider = createOpenAI({
  apiKey: process.env.QWEN_API_KEY,
  baseURL: process.env.QWEN_BASE_URL,
});

// Force the Chat Completions API. @ai-sdk/openai v3 defaults to OpenAI's
// new Responses API (`/v1/responses`) when the provider is called as a
// function, but Alibaba Model Studio's OpenAI-compatible mode only
// implements `/v1/chat/completions`. Wrapping with `.chat()` here means
// callers can still write `qwen('qwen-plus')` without remembering.
export const qwen: typeof qwenProvider.chat = (modelId): ReturnType<typeof qwenProvider.chat> => qwenProvider.chat(modelId);
