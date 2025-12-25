import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create production table to track multiple concurrent production cycles
  await db.schema
    .createTable("production")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("business_id", "uuid", (col) =>
      col.notNull().references("businesses.id").onDelete("cascade")
    )
    .addColumn("cycles", "integer", (col) =>
      col.notNull().comment("Total cycles in this batch")
    )
    .addColumn("cycles_remaining", "integer", (col) =>
      col.notNull().comment("Cycles not yet claimed")
    )
    .addColumn("input_quantities", "jsonb", (col) =>
      col.notNull().comment("Input quantities: { assetId: quantity }")
    )
    .addColumn("production_started_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`).comment("When production started")
    )
    .addColumn("cycle_completion_time", "integer", (col) =>
      col.notNull().comment("Seconds per cycle")
    )
    .addColumn("status", "varchar(20)", (col) =>
      col.notNull().defaultTo("active").comment("active, completed, or claimed")
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Create indexes
  await db.schema
    .createIndex("idx_production_business_id")
    .on("production")
    .column("business_id")
    .execute();

  await db.schema
    .createIndex("idx_production_status")
    .on("production")
    .column("status")
    .execute();

  // Add last_claimed_at to businesses table
  await db.schema
    .alterTable("businesses")
    .addColumn("last_claimed_at", "timestamp", (col) =>
      col.comment("Last time any production batch was claimed")
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("production").ifExists().execute();
  
  // Remove last_claimed_at column from businesses
  await db.schema
    .alterTable("businesses")
    .dropColumn("last_claimed_at")
    .ifExists()
    .execute();
}

