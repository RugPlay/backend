import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('businesses')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('category', 'varchar', (col) => col.notNull())
    .addColumn('corporation_id', 'uuid', (col) => col.notNull().references('corporations.id').onDelete('restrict'))
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Unique constraint: one business per name per corporation (optional, adjust as needed)
  await db.schema
    .createIndex('uq_businesses_name_corporation')
    .on('businesses')
    .columns(['name', 'corporation_id'])
    .unique()
    .execute();

  // Create indexes for performance
  await db.schema.createIndex('idx_businesses_name').on('businesses').column('name').execute();
  await db.schema.createIndex('idx_businesses_category').on('businesses').column('category').execute();
  await db.schema.createIndex('idx_businesses_corporation_id').on('businesses').column('corporation_id').execute();
  await db.schema.createIndex('idx_businesses_is_active').on('businesses').column('is_active').execute();
  await db.schema.createIndex('idx_businesses_created_at').on('businesses').column('created_at').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('businesses').ifExists().execute();
}

