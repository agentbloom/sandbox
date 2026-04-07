import redis from '@/lib/model/redis.js';
import logger from '@/lib/model/logger.js';

type EventType = 'generator:started' | 'generator:progress' | 'generator:complete' | 'generator:failed';

interface GeneratorEvent {
  type: EventType;
  workflowId: string;
  timestamp: string;
  source: 'generator';
  message: string;
  data: Record<string, unknown>;
}

async function publishEvent(workflowId: string, type: EventType, message: string, data: Record<string, unknown> = {}): Promise<void> {
  const event: GeneratorEvent = {
    type,
    workflowId,
    timestamp: new Date().toISOString(),
    source: 'generator',
    message,
    data,
  };

  const channel = `generator:${workflowId}`;

  logger.info(`[${type}] ${message}`);

  try {
    await redis.publish(channel, JSON.stringify(event));
  } catch (error) {
    logger.error({ err: error }, 'Failed to publish event to Redis');
  }
}

export default publishEvent;
