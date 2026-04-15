import { createAnthropic } from '@ai-sdk/anthropic';

const anthropicProvider = createAnthropic({
  // This is the Anthropic API key used by the platform to run security reviews, and deliberately 
  // does not collide with ANTHROPIC_API_KEY which is used by Claude Code if set, rather than the OAuth token
  apiKey: process.env.PLATFORM_ANTHROPIC_API_KEY,
});

export const anthropic = (modelId: string): ReturnType<typeof anthropicProvider> => anthropicProvider(modelId);
