import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('corporations')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col)
    .addColumn('industry', 'varchar', (col) => col.notNull())
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Create indexes for performance
  await db.schema.createIndex('idx_corporations_name').on('corporations').column('name').execute();
  await db.schema.createIndex('idx_corporations_industry').on('corporations').column('industry').execute();
  await db.schema.createIndex('idx_corporations_is_active').on('corporations').column('is_active').execute();
  await db.schema.createIndex('idx_corporations_created_at').on('corporations').column('created_at').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('corporations').ifExists().execute();
}

