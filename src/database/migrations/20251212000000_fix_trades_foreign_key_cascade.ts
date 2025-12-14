import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Drop the existing foreign key constraints by dropping and recreating the columns
  // This is necessary because PostgreSQL doesn't support altering foreign key constraints directly
  
  // First, drop the foreign key constraints by dropping the columns
  await db.schema.alterTable('trades').dropColumn('taker_order_id').execute();
  await db.schema.alterTable('trades').dropColumn('maker_order_id').execute();
  
  // Recreate the columns with restrict instead of cascade
  // This prevents trades from being deleted when orders are deleted
  await db.schema.alterTable('trades')
    .addColumn('taker_order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('restrict'))
    .addColumn('maker_order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('restrict'))
    .execute();
  
  // Recreate the indexes
  await db.schema.createIndex('idx_trades_taker_order_id').on('trades').column('taker_order_id').execute();
  await db.schema.createIndex('idx_trades_maker_order_id').on('trades').column('maker_order_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Revert back to cascade delete
  await db.schema.alterTable('trades').dropColumn('taker_order_id').execute();
  await db.schema.alterTable('trades').dropColumn('maker_order_id').execute();
  
  await db.schema.alterTable('trades')
    .addColumn('taker_order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('cascade'))
    .addColumn('maker_order_id', 'uuid', (col) => col.notNull().references('orders.id').onDelete('cascade'))
    .execute();
  
  await db.schema.createIndex('idx_trades_taker_order_id').on('trades').column('taker_order_id').execute();
  await db.schema.createIndex('idx_trades_maker_order_id').on('trades').column('maker_order_id').execute();
}

