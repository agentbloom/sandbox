import Redis from 'ioredis';

const url = process.env.REDIS_URL;

if (!url) {
  throw new Error('REDIS_URL environment variable is not set');
}

const redis = new Redis(url, { maxRetriesPerRequest: null });

export default redis;
