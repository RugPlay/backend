import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create table without primary key constraint first
  // TimescaleDB requires unique indexes (including primary keys) to include the partitioning column
  // Primary key will be added in the hypertables migration after conversion
  await db.schema
    .createTable('trades')
    .addColumn('id', 'uuid', (col) => col.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('trade_id', 'varchar', (col) => col.notNull())
    .addColumn('market_id', 'uuid', (col) => col.notNull().references('markets.id').onDelete('cascade'))
    .addColumn('taker_order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('set null')) // The incoming order that triggered the match
    .addColumn('maker_order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('set null')) // The existing order that was matched
    .addColumn('taker_side', sql`order_side_enum`, (col) => col.notNull()) // Whether taker was buying or selling
    .addColumn('type', 'varchar(20)', (col) => col.notNull().defaultTo('real')) // Trade type (only real trades supported)
    .addColumn('quantity', sql`decimal(20,8)`, (col) => col.notNull())
    .addColumn('price', sql`decimal(20,8)`, (col) => col.notNull())
    .addColumn('taker_corporation_id', 'uuid', (col) => col.notNull().references('corporations.id').onDelete('restrict'))
    .addColumn('maker_corporation_id', 'uuid', (col) => col.notNull().references('corporations.id').onDelete('restrict'))
    .addColumn('taker_holding_id', 'uuid', (col) => col.references('holdings.id').onDelete('set null'))
    .addColumn('maker_holding_id', 'uuid', (col) => col.references('holdings.id').onDelete('set null'))
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.alterTable('trades').addPrimaryKeyConstraint('trades_pkey', ['id', 'created_at']).execute();

  // Create indexes for performance
  // Note: trade_id unique constraint removed - TimescaleDB hypertables require unique indexes to include partitioning column
  // Uniqueness is enforced at application level
  await db.schema.createIndex('idx_trades_market_id').on('trades').column('market_id').execute();
  await db.schema.createIndex('idx_trades_trade_id').on('trades').column('trade_id').execute();
  await db.schema.createIndex('idx_trades_market_created').on('trades').columns(['market_id', 'created_at']).execute();
  await db.schema.createIndex('idx_trades_taker_order_id').on('trades').column('taker_order_id').execute();
  await db.schema.createIndex('idx_trades_maker_order_id').on('trades').column('maker_order_id').execute();
  await db.schema.createIndex('idx_trades_taker_corporation_id').on('trades').column('taker_corporation_id').execute();
  await db.schema.createIndex('idx_trades_maker_corporation_id').on('trades').column('maker_corporation_id').execute();
  await db.schema.createIndex('idx_trades_taker_side').on('trades').column('taker_side').execute();
  await db.schema.createIndex('idx_trades_market_taker_side').on('trades').columns(['market_id', 'taker_side']).execute();
  await db.schema.createIndex('idx_trades_type').on('trades').column('type').execute();
  await db.schema.createIndex('idx_trades_market_type').on('trades').columns(['market_id', 'type']).execute();
  await db.schema.createIndex('idx_trades_created_at').on('trades').column('created_at').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('trades').ifExists().execute();
}
