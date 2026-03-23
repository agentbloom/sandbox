type LogLevel = 'info' | 'warn' | 'error';
type StateCode = 'GENERATION_COMPLETE' | 'GENERATION_FAILED';

async function sendWebhookNotification(workflowId: string, level: LogLevel, message: string, code?: StateCode): Promise<void> {
  const apiUrl = process.env.API_URL!;
  const sandboxWebhookSecret = process.env.SANDBOX_WEBHOOK_SECRET!;

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
      }),
    });

    // Consume the response body to prevent connection leaks
    await response.text();
  } catch {
    // non-fatal — sandbox continues even if log delivery fails
  }
}

export default sendWebhookNotification;
