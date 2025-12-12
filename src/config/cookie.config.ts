export default {
  domain: (process.env.COOKIE_DOMAIN || process.env.APP_DOMAIN || 'localhost')
    .replace(/\/$/, '')
    .replace(/(^\w+:|^)\/\//, ''),
};