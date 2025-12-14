import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add portfolio ID columns to trades table
  await db.schema
    .alterTable('trades')
    .addColumn('taker_portfolio_id', 'uuid', (col) => col.references('portfolios.id').onDelete('set null'))
    .addColumn('maker_portfolio_id', 'uuid', (col) => col.references('portfolios.id').onDelete('set null'))
    .execute();

  // Create indexes for the new columns
  await db.schema
    .createIndex('idx_trades_taker_portfolio_id')
    .on('trades')
    .column('taker_portfolio_id')
    .execute();

  await db.schema
    .createIndex('idx_trades_maker_portfolio_id')
    .on('trades')
    .column('maker_portfolio_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes
  await db.schema
    .dropIndex('idx_trades_taker_portfolio_id')
    .ifExists()
    .execute();

  await db.schema
    .dropIndex('idx_trades_maker_portfolio_id')
    .ifExists()
    .execute();

  // Drop columns
  await db.schema
    .alterTable('trades')
    .dropColumn('taker_portfolio_id')
    .dropColumn('maker_portfolio_id')
    .execute();
}

