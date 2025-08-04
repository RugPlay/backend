import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

const user = process.env.SQL_DB_USER;
const password = process.env.SQL_DB_PASSWORD;
const host = process.env.SQL_DB_HOST;
const port = process.env.SQL_DB_PORT;
const database = process.env.SQL_DB_NAME;

export const auth = betterAuth({
  database: new Pool({
    connectionString: `postgres://${user}:${password}@${host}:${port}/${database}`,
  }),
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
    },
  },
});
