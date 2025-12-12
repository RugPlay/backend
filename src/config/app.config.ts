export default {
  name: process.env.APP_NAME || 'StonkWar',
  domain: (process.env.APP_DOMAIN || 'localhost').replace(/\/$/, ''),
  port: parseInt(process.env.APP_PORT || '3001', 10) || 3000,
  secret: process.env.APP_SECRET || 'secret',
  environment: process.env.NODE_ENV || 'local',
  debug: ['local', 'development', 'test'].includes(process.env.NODE_ENV?.toLowerCase()),
};