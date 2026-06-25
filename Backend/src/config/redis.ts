import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

const redisSubscriber = redisClient.duplicate();

redisClient.on('error', (err) => console.log('❌ Redis Publisher Error', err));
redisClient.on('connect', () => console.log('✅ Redis Publisher Connected'));

redisSubscriber.on('error', (err) => console.log('❌ Redis Subscriber Error', err));
redisSubscriber.on('connect', () => console.log('✅ Redis Subscriber Connected'));

export const connectRedis = async () => {
  try {
    await redisClient.connect();
    await redisSubscriber.connect();
  } catch (error) {
    console.error(`❌ Redis Connection Error: ${error}`);
  }
};

export { redisClient as default, redisSubscriber };
