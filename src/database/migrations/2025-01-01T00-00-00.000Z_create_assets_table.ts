import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('assets')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('symbol', 'varchar(20)', (col) => col.notNull().unique()) // e.g., 'USD', 'EUR', 'BTC', 'ETH'
    .addColumn('name', 'varchar(100)', (col) => col.notNull()) // e.g., 'US Dollar', 'Bitcoin'
    .addColumn('type', 'varchar(20)', (col) => col.notNull()) // 'currency', 'crypto', 'commodity', 'stock', etc.
    .addColumn('decimals', 'integer', (col) => col.notNull().defaultTo(8)) // Decimal places for precision
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
    .execute();

  // Create indexes for assets
  await db.schema
    .createIndex('idx_assets_symbol')
    .on('assets')
    .column('symbol')
    .execute();

  await db.schema
    .createIndex('idx_assets_type')
    .on('assets')
    .column('type')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('assets').ifExists().execute();
}

