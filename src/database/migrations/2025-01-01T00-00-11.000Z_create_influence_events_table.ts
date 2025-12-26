import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create influence_events table to track all influence purchases and spends
  // This is the single source of truth for influence balances
  await db.schema
    .createTable("influence_events")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("corporation_id", "uuid", (col) =>
      col.notNull().references("corporations.id").onDelete("cascade")
    )
    .addColumn("event_type", "varchar(20)", (col) =>
      col.notNull()
    )
    .addColumn("amount", sql`decimal(20,8)`, (col) =>
      col.notNull()
    )
    .addColumn("balance_after", sql`decimal(20,8)`, (col) =>
      col.notNull()
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Create indexes for fast leaderboard queries
  await db.schema
    .createIndex("idx_influence_events_corporation_created")
    .on("influence_events")
    .columns(["corporation_id", "created_at"])
    .execute();

  await db.schema
    .createIndex("idx_influence_events_type_created")
    .on("influence_events")
    .columns(["event_type", "created_at"])
    .execute();

  await db.schema
    .createIndex("idx_influence_events_corporation_type")
    .on("influence_events")
    .columns(["corporation_id", "event_type"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("influence_events").ifExists().execute();
}
