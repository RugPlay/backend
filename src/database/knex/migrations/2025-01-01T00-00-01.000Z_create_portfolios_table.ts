import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("portfolios", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("user_id").notNullable().unique(); // From better-auth user table
    table.decimal("balance", 20, 8).notNullable().defaultTo(0); // Dollar balance
    table.enum("type", ["paper", "real"]).notNullable().defaultTo("real"); // Account type
    table.timestamps(true, true);

    // Indexes for performance
    table.index("user_id");
    table.index("created_at");
    table.index("type");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("portfolios");
}
