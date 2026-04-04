const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicResponse {
  content: Array<{ text: string }>;
}

const apiKey = process.env.ANTHROPIC_API_KEY;

async function createMessage(model: string, messages: AnthropicMessage[], maxTokens: number = 1024): Promise<AnthropicResponse> {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const response = await fetch(`${ANTHROPIC_API_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const result = await response.json() as AnthropicResponse;

  return result;
}

const anthropic = { createMessage };

export default anthropic;
