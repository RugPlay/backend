import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add user_id column to holdings table
  await db.schema
    .alterTable('holdings')
    .addColumn('user_id', 'varchar', (col) => col.notNull())
    .execute();

  // Populate user_id from portfolios table for existing holdings
  await sql`
    UPDATE holdings
    SET user_id = portfolios.user_id
    FROM portfolios
    WHERE holdings.portfolio_id = portfolios.id
  `.execute(db);

  // Create index for user_id
  await db.schema
    .createIndex('idx_holdings_user_id')
    .on('holdings')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex('idx_holdings_user_id')
    .on('holdings')
    .ifExists()
    .execute();

  await db.schema
    .alterTable('holdings')
    .dropColumn('user_id')
    .execute();
}

