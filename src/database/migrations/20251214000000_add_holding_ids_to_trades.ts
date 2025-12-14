import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add holding ID columns to trades table
  await db.schema
    .alterTable('trades')
    .addColumn('taker_holding_id', 'uuid', (col) => col.references('holdings.id').onDelete('set null'))
    .addColumn('maker_holding_id', 'uuid', (col) => col.references('holdings.id').onDelete('set null'))
    .execute();

  // Create indexes for the new columns
  await db.schema.createIndex('idx_trades_taker_holding_id').on('trades').column('taker_holding_id').execute();
  await db.schema.createIndex('idx_trades_maker_holding_id').on('trades').column('maker_holding_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes
  await db.schema.dropIndex('idx_trades_taker_holding_id').on('trades').ifExists().execute();
  await db.schema.dropIndex('idx_trades_maker_holding_id').on('trades').ifExists().execute();

  // Drop columns
  await db.schema
    .alterTable('trades')
    .dropColumn('taker_holding_id')
    .dropColumn('maker_holding_id')
    .execute();
}

