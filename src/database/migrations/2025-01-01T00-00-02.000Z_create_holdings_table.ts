import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('holdings')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'varchar', (col) => col.notNull()) // User who owns this holding
    .addColumn('asset_id', 'uuid', (col) => col.notNull().references('assets.id').onDelete('restrict')) // Asset being held
    .addColumn('quantity', sql`decimal(20,8)`, (col) => col.notNull().defaultTo('0')) // Quantity of the asset
    .addColumn('average_cost_basis', sql`decimal(20,8)`, (col) => col.notNull().defaultTo('0')) // Average cost per unit
    .addColumn('total_cost', sql`decimal(20,8)`, (col) => col.notNull().defaultTo('0')) // Total cost (quantity * average_cost_basis)
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Unique constraint: one holding per user per asset
  await db.schema
    .createIndex('uq_holdings_user_asset')
    .on('holdings')
    .columns(['user_id', 'asset_id'])
    .unique()
    .execute();

  // Create indexes for performance
  await db.schema.createIndex('idx_holdings_user_id').on('holdings').column('user_id').execute();
  await db.schema.createIndex('idx_holdings_asset_id').on('holdings').column('asset_id').execute();
  await db.schema.createIndex('idx_holdings_user_asset').on('holdings').columns(['user_id', 'asset_id']).execute();
  await db.schema.createIndex('idx_holdings_created_at').on('holdings').column('created_at').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('holdings').ifExists().execute();
}

