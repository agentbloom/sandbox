import Redis from 'ioredis';
import logger from '@/lib/model/logger.js';

const url = process.env.REDIS_URL;

if (!url) {
  throw new Error('REDIS_URL environment variable is not set');
}

const redis = new Redis(url, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) {
      return null;
    }

    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

export default redis;
