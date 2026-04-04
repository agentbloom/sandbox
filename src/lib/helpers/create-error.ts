import publishEvent from './publish-event.js';

async function createError(workflowId: string, message: string, err: unknown): Promise<never> {
  const detail = err instanceof Error ? err.message : String(err);

  await publishEvent(workflowId, 'generator:failed', `${message}: ${detail}`, { error: `${message}: ${detail}` });

  process.exit(1);
}

export default createError;
