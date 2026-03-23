import sendWebhookNotification from './send-webhook-notification.js';

type StateCode = 'GENERATION_COMPLETE' | 'GENERATION_FAILED';

async function createError(workflowId: string, message: string, err: unknown, code?: StateCode): Promise<never> {
  const detail = err instanceof Error ? err.message : String(err);

  await sendWebhookNotification(workflowId, 'error', `${message}: ${detail}`, code);

  process.exit(1);
}

export default createError;
