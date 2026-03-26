type LogLevel = 'info' | 'warn' | 'error';
type StateCode = 'GENERATION_COMPLETE' | 'GENERATION_FAILED';

interface WebhookOptions {
  code?: StateCode;
  githubRepoUrl?: string;
}

async function sendWebhookNotification(workflowId: string, level: LogLevel, message: string, options?: StateCode | WebhookOptions): Promise<void> {
  const apiUrl = process.env.API_URL!;
  const apiSecret = process.env.API_SECRET!;

  const code = typeof options === 'string' ? options : options?.code;
  const githubRepoUrl = typeof options === 'object' ? options?.githubRepoUrl : undefined;

  console.log(`[${level.toUpperCase()}] ${message}`);

  try {
    const response = await fetch(`${apiUrl}/api/v1/webhooks/sandbox`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiSecret}`,
      },
      body: JSON.stringify({
        workflowId,
        level,
        message,
        ...(code ? { code } : {}),
        ...(githubRepoUrl ? { githubRepoUrl } : {}),
      }),
    });

    await response.text();
  } catch {
    // non-fatal — sandbox continues even if log delivery fails
  }
}

export default sendWebhookNotification;
