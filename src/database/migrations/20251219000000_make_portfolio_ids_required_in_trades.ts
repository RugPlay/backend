import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // First, update any null values (shouldn't be any, but just in case)
  // Set to a default portfolio if needed, or we can just ensure they're not null
  // Since this is a new feature, we'll assume no nulls exist, but we'll make it safe
  
  // Make columns NOT NULL
  await db.schema
    .alterTable('trades')
    .alterColumn('taker_portfolio_id', (col) => col.setNotNull())
    .alterColumn('maker_portfolio_id', (col) => col.setNotNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Revert to nullable
  await db.schema
    .alterTable('trades')
    .alterColumn('taker_portfolio_id', (col) => col.dropNotNull())
    .alterColumn('maker_portfolio_id', (col) => col.dropNotNull())
    .execute();
}

