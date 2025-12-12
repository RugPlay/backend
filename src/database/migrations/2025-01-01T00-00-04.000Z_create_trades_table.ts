import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('trades')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('trade_id', 'varchar', (col) => col.notNull().unique())
    .addColumn('market_id', 'varchar', (col) => col.notNull()) // Will be changed to UUID in later migration
    .addColumn('taker_order_id', 'varchar', (col) => col.notNull()) // The incoming order that triggered the match
    .addColumn('maker_order_id', 'varchar', (col) => col.notNull()) // The existing order that was matched
    .addColumn('taker_side', sql`order_side_enum`, (col) => col.notNull()) // Whether taker was buying or selling
    .addColumn('type', 'varchar(20)', (col) => col.notNull().defaultTo('real')) // Trade type (only real trades supported)
    .addColumn('quantity', sql`decimal(20,8)`, (col) => col.notNull())
    .addColumn('price', sql`decimal(20,8)`, (col) => col.notNull())
    .addColumn('taker_user_id', 'varchar')
    .addColumn('maker_user_id', 'varchar')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Create indexes for performance
  await db.schema.createIndex('idx_trades_market_id').on('trades').column('market_id').execute();
  await db.schema.createIndex('idx_trades_trade_id').on('trades').column('trade_id').execute();
  await db.schema.createIndex('idx_trades_market_created').on('trades').columns(['market_id', 'created_at']).execute();
  await db.schema.createIndex('idx_trades_taker_order_id').on('trades').column('taker_order_id').execute();
  await db.schema.createIndex('idx_trades_maker_order_id').on('trades').column('maker_order_id').execute();
  await db.schema.createIndex('idx_trades_taker_side').on('trades').column('taker_side').execute();
  await db.schema.createIndex('idx_trades_market_taker_side').on('trades').columns(['market_id', 'taker_side']).execute();
  await db.schema.createIndex('idx_trades_type').on('trades').column('type').execute();
  await db.schema.createIndex('idx_trades_market_type').on('trades').columns(['market_id', 'type']).execute();
  await db.schema.createIndex('idx_trades_created_at').on('trades').column('created_at').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('trades').ifExists().execute();
}
