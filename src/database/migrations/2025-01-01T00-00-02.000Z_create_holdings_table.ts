import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('holdings')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('portfolio_id', 'uuid', (col) => col.notNull().references('portfolios.id').onDelete('cascade')) // Reference to portfolios table
    .addColumn('market_id', 'uuid', (col) => col.notNull().references('markets.id').onDelete('cascade')) // Reference to markets table
    .addColumn('quantity', sql`decimal(20,8)`, (col) => col.notNull().defaultTo('0')) // Number of shares/units
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Composite unique constraint to prevent duplicate holdings per portfolio per market
  await db.schema
    .createIndex('uq_holdings_portfolio_market')
    .on('holdings')
    .columns(['portfolio_id', 'market_id'])
    .unique()
    .execute();

  // Create indexes for performance
  await db.schema.createIndex('idx_holdings_portfolio_id').on('holdings').column('portfolio_id').execute();
  await db.schema.createIndex('idx_holdings_market_id').on('holdings').column('market_id').execute();
  await db.schema.createIndex('idx_holdings_portfolio_market').on('holdings').columns(['portfolio_id', 'market_id']).execute();
  await db.schema.createIndex('idx_holdings_created_at').on('holdings').column('created_at').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('holdings').ifExists().execute();
}
