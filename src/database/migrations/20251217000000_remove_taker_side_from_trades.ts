import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Drop indexes that include taker_side
  await db.schema
    .dropIndex('idx_trades_taker_side')
    .ifExists()
    .execute();

  await db.schema
    .dropIndex('idx_trades_market_taker_side')
    .ifExists()
    .execute();

  // Drop the taker_side column
  await db.schema
    .alterTable('trades')
    .dropColumn('taker_side')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Re-add the column
  await db.schema
    .alterTable('trades')
    .addColumn('taker_side', sql`order_side_enum`, (col) => col.notNull().defaultTo('bid'))
    .execute();

  // Re-add indexes
  await db.schema
    .createIndex('idx_trades_taker_side')
    .on('trades')
    .column('taker_side')
    .execute();

  await db.schema
    .createIndex('idx_trades_market_taker_side')
    .on('trades')
    .columns(['market_id', 'taker_side'])
    .execute();
}

