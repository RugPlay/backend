import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('portfolios')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'varchar', (col) => col.notNull().unique()) // From better-auth user table
    .addColumn('balance', sql`decimal(20,8)`, (col) => col.notNull().defaultTo('0')) // Dollar balance
    .addColumn('type', 'varchar(20)', (col) => col.notNull().defaultTo('real')) // Account type (only real accounts supported)
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Create indexes for performance
  await db.schema.createIndex('idx_portfolios_user_id').on('portfolios').column('user_id').execute();
  await db.schema.createIndex('idx_portfolios_created_at').on('portfolios').column('created_at').execute();
  await db.schema.createIndex('idx_portfolios_type').on('portfolios').column('type').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('portfolios').ifExists().execute();
}
