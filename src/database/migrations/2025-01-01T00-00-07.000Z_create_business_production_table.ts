import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create business_production table to track production progress
  await db.schema
    .createTable("business_production")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("business_id", "uuid", (col) =>
      col.notNull().references("businesses.id").onDelete("cascade").unique()
    )
    .addColumn("accumulated_time", "integer", (col) =>
      col.notNull().defaultTo(0).comment("Accumulated production time in seconds")
    )
    .addColumn("last_updated", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Create index
  await db.schema
    .createIndex("idx_business_production_business_id")
    .on("business_production")
    .column("business_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("business_production").ifExists().execute();
}

