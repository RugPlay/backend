import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create business_inputs table
  await db.schema
    .createTable("business_inputs")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("business_id", "uuid", (col) =>
      col.notNull().references("businesses.id").onDelete("cascade")
    )
    .addColumn("asset_id", "uuid", (col) =>
      col.notNull().references("assets.id").onDelete("cascade")
    )
    .addColumn("quantity", "numeric", (col) => col.notNull())
    .addColumn("name", "varchar(255)")
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Create business_outputs table
  await db.schema
    .createTable("business_outputs")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("business_id", "uuid", (col) =>
      col.notNull().references("businesses.id").onDelete("cascade")
    )
    .addColumn("asset_id", "uuid", (col) =>
      col.notNull().references("assets.id").onDelete("cascade")
    )
    .addColumn("quantity", "numeric", (col) => col.notNull())
    .addColumn("name", "varchar(255)")
    .addColumn("production_time", "integer", (col) =>
      col.comment("Production time in seconds")
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
    .createIndex("idx_business_inputs_business_id")
    .on("business_inputs")
    .column("business_id")
    .execute();

  await db.schema
    .createIndex("idx_business_inputs_asset_id")
    .on("business_inputs")
    .column("asset_id")
    .execute();

  await db.schema
    .createIndex("idx_business_outputs_business_id")
    .on("business_outputs")
    .column("business_id")
    .execute();

  await db.schema
    .createIndex("idx_business_outputs_asset_id")
    .on("business_outputs")
    .column("asset_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("business_outputs").ifExists().execute();
  await db.schema.dropTable("business_inputs").ifExists().execute();
}

