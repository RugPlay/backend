import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create enum type for order side
  await sql`CREATE TYPE order_side_enum AS ENUM ('bid', 'ask')`.execute(db);

  await db.schema
    .createTable('orders')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('market_id', 'uuid', (col) => col.notNull().references('markets.id').onDelete('cascade'))
    .addColumn('corporation_id', 'uuid', (col) => col.notNull().references('corporations.id').onDelete('restrict')) // Corporation placing the order
    .addColumn('quote_asset_id', 'uuid', (col) => col.notNull().references('assets.id').onDelete('restrict')) // Quote asset (for both BID and ASK orders)
    .addColumn('side', sql`order_side_enum`, (col) => col.notNull())
    .addColumn('price', sql`decimal(20,8)`, (col) => col.notNull()) // Support high precision prices
    .addColumn('quantity', sql`decimal(20,8)`, (col) => col.notNull()) // Support high precision quantities
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Create indexes for efficient queries
  // Composite index for efficient order book queries
  await db.schema.createIndex('idx_orders_market_side_price').on('orders').columns(['market_id', 'side', 'price']).execute();

  // Index for efficient corporation-based queries
  await db.schema.createIndex('idx_orders_corporation_id').on('orders').column('corporation_id').execute();

  // Index for quote asset queries
  await db.schema.createIndex('idx_orders_quote_asset_id').on('orders').column('quote_asset_id').execute();

  // Index for order lookup by ID
  await db.schema.createIndex('idx_orders_id').on('orders').column('id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('orders').execute();
  await sql`DROP TYPE IF EXISTS order_side_enum`.execute(db);
}
