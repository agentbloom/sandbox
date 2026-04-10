const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicResponse {
  content: Array<{ text: string }>;
}

// IMPORTANT: this deliberately reads CLAUDE_API_KEY, not
// ANTHROPIC_API_KEY. ANTHROPIC_API_KEY must NOT exist in this container's
// environment, otherwise Claude Code will pick it up and bill every
// generation through the API key instead of the OAuth subscription token.
async function createMessage(model: string, messages: AnthropicMessage[], maxTokens: number = 1024): Promise<AnthropicResponse> {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY environment variable is not set');
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
