export default {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10) || 6379,
  db: parseInt(process.env.REDIS_DB || '1', 10) || 1,
  password: process.env.REDIS_PASSWORD || 'password',
  keyPrefix: process.env.REDIS_PREFIX,
};