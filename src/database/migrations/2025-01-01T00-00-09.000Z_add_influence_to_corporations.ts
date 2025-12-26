import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add influence tracking columns to corporations table
  await db.schema
    .alterTable("corporations")
    .addColumn("influence_base", sql`decimal(20,8)`, (col) =>
      col.notNull().defaultTo("0").comment("Base influence amount at last_updated_at")
    )
    .addColumn("influence_last_updated_at", "timestamp", (col) =>
      col.comment("When influence_base was last updated")
    )
    .execute();

  // Create index for leaderboard queries
  await db.schema
    .createIndex("idx_corporations_influence_base")
    .on("corporations")
    .column("influence_base")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex("idx_corporations_influence_base")
    .ifExists()
    .on("corporations")
    .execute();

  await db.schema
    .alterTable("corporations")
    .dropColumn("influence_base")
    .dropColumn("influence_last_updated_at")
    .execute();
}

