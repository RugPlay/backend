import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create enum type first
  await sql`CREATE TYPE category_enum AS ENUM ('futures', 'commodities', 'forex', 'crypto', 'stocks', 'indices', 'bonds')`.execute(db);

  await db.schema
    .createTable('markets')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('symbol', 'varchar', (col) => col.notNull().unique()) // e.g., "BTC-USD", "EUR-USD", "GOLD"
    .addColumn('name', 'varchar', (col) => col.notNull()) // e.g., "Bitcoin/US Dollar", "Euro/US Dollar", "Gold"
    .addColumn('category', sql`category_enum`, (col) => col.notNull())
    .addColumn('subcategory', 'varchar') // e.g., "energy", "metals", "major", "altcoin"
    .addColumn('base_currency', 'varchar', (col) => col.notNull()) // e.g., "BTC", "EUR", "GOLD"
    .addColumn('quote_currency', 'varchar', (col) => col.notNull()) // e.g., "USD", "JPY", "EUR"
    .addColumn('min_price_increment', sql`decimal(20,8)`, (col) => col.notNull().defaultTo('0.01')) // Minimum price movement
    .addColumn('min_quantity_increment', sql`decimal(20,8)`, (col) => col.notNull().defaultTo('0.00000001')) // Minimum quantity
    .addColumn('max_quantity', sql`decimal(20,8)`) // Maximum order quantity
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true)) // Whether trading is enabled
    .addColumn('is_24h', 'boolean', (col) => col.notNull().defaultTo(false)) // Whether market trades 24/7
    .addColumn('trading_start', 'time') // Trading session start time
    .addColumn('trading_end', 'time') // Trading session end time
    .addColumn('timezone', 'varchar', (col) => col.defaultTo('UTC')) // Trading session timezone
    .addColumn('metadata', 'jsonb') // Additional market-specific data
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
    .execute();

  // Create indexes for efficient queries
  await db.schema.createIndex('idx_markets_category_subcategory').on('markets').columns(['category', 'subcategory']).execute();
  await db.schema.createIndex('idx_markets_base_quote_currency').on('markets').columns(['base_currency', 'quote_currency']).execute();
  await db.schema.createIndex('idx_markets_is_active').on('markets').column('is_active').execute();
  await db.schema.createIndex('idx_markets_symbol').on('markets').column('symbol').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('markets').execute();
  await sql`DROP TYPE IF EXISTS category_enum`.execute(db);
}
