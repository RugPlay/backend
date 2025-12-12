import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // First, check if the trades table has any data
  const result = await db.selectFrom('trades').select(db.fn.count('id').as('count')).executeTakeFirst();
  
  if (result && parseInt(result.count as string) > 0) {
    throw new Error(
      "Cannot modify trades table structure with existing data. Please backup and migrate data manually."
    );
  }

  // Drop existing indexes first
  await db.schema.dropIndex('idx_trades_market_id').execute();
  await db.schema.dropIndex('idx_trades_taker_order_id').execute();
  await db.schema.dropIndex('idx_trades_maker_order_id').execute();
  
  // Change market_id from string to UUID with foreign key
  await db.schema.alterTable('trades').dropColumn('market_id').execute();
  await db.schema.alterTable('trades')
    .addColumn('market_id', 'uuid', (col) => col.notNull().references('markets.id').onDelete('cascade'))
    .execute();
  
  // Change order IDs from string to UUID with foreign keys
  await db.schema.alterTable('trades').dropColumn('taker_order_id').execute();
  await db.schema.alterTable('trades').dropColumn('maker_order_id').execute();
  await db.schema.alterTable('trades')
    .addColumn('taker_order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('cascade'))
    .addColumn('maker_order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('cascade'))
    .execute();
  
  // Recreate indexes
  await db.schema.createIndex('idx_trades_market_id').on('trades').column('market_id').execute();
  await db.schema.createIndex('idx_trades_taker_order_id').on('trades').column('taker_order_id').execute();
  await db.schema.createIndex('idx_trades_maker_order_id').on('trades').column('maker_order_id').execute();
  await db.schema.createIndex('idx_trades_market_created').on('trades').columns(['market_id', 'created_at']).execute();
  await db.schema.createIndex('idx_trades_market_taker_side').on('trades').columns(['market_id', 'taker_side']).execute();
  await db.schema.createIndex('idx_trades_market_type').on('trades').columns(['market_id', 'type']).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop foreign key constraints by dropping and recreating columns
  await db.schema.alterTable('trades').dropColumn('market_id').execute();
  await db.schema.alterTable('trades').dropColumn('taker_order_id').execute();
  await db.schema.alterTable('trades').dropColumn('maker_order_id').execute();
  
  // Drop indexes
  await db.schema.dropIndex('idx_trades_market_created').execute();
  await db.schema.dropIndex('idx_trades_market_taker_side').execute();
  await db.schema.dropIndex('idx_trades_market_type').execute();
  
  // Change back to string columns
  await db.schema.alterTable('trades')
    .addColumn('market_id', 'varchar', (col) => col.notNull())
    .addColumn('taker_order_id', 'varchar', (col) => col.notNull())
    .addColumn('maker_order_id', 'varchar', (col) => col.notNull())
    .execute();
  
  // Recreate original indexes
  await db.schema.createIndex('idx_trades_market_id').on('trades').column('market_id').execute();
  await db.schema.createIndex('idx_trades_taker_order_id').on('trades').column('taker_order_id').execute();
  await db.schema.createIndex('idx_trades_maker_order_id').on('trades').column('maker_order_id').execute();
  await db.schema.createIndex('idx_trades_market_created').on('trades').columns(['market_id', 'created_at']).execute();
  await db.schema.createIndex('idx_trades_market_taker_side').on('trades').columns(['market_id', 'taker_side']).execute();
  await db.schema.createIndex('idx_trades_market_type').on('trades').columns(['market_id', 'type']).execute();
}