type LogLevel = 'info' | 'warn' | 'error';
type StateCode = 'GENERATION_COMPLETE' | 'GENERATION_FAILED';

interface WebhookOptions {
  code?: StateCode;
  imageRef?: string;
}

async function sendWebhookNotification(workflowId: string, level: LogLevel, message: string, options?: StateCode | WebhookOptions): Promise<void> {
  const apiUrl = process.env.API_URL!;
  const sandboxWebhookSecret = process.env.SANDBOX_WEBHOOK_SECRET!;

  // Support both old signature (code as string) and new signature (options object)
  const code = typeof options === 'string' ? options : options?.code;
  const imageRef = typeof options === 'object' ? options?.imageRef : undefined;

  console.log(`[${level.toUpperCase()}] ${message}`);

  try {
    const response = await fetch(`${apiUrl}/api/v1/webhooks/sandbox/${sandboxWebhookSecret}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId,
        level,
        message,
        ...(code ? { code } : {}),
        ...(imageRef ? { imageRef } : {}),
      }),
    });

    // Consume the response body to prevent connection leaks
    await response.text();
  } catch {
    // non-fatal — sandbox continues even if log delivery fails
  }
}

export default sendWebhookNotification;
