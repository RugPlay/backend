import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import sqlConfig from '../src/config/sql.config';

async function resetDatabase() {
  const pool = new Pool(sqlConfig);
  const db = new Kysely<any>({
    dialect: new PostgresDialect({ pool }),
  });

  try {
    // Drop the public schema and recreate it
    await sql`DROP SCHEMA IF EXISTS public CASCADE`.execute(db);
    await sql`CREATE SCHEMA public`.execute(db);
    await sql`GRANT ALL ON SCHEMA public TO postgres`.execute(db);
    await sql`GRANT ALL ON SCHEMA public TO public`.execute(db);
    
    console.log('Successfully reset database schema');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

resetDatabase();

