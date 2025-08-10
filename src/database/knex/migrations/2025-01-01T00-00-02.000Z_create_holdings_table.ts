import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("holdings", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("portfolio_id").notNullable(); // Reference to portfolios table
    table.string("market_id").notNullable(); // Reference to markets table
    table.decimal("quantity", 20, 8).notNullable().defaultTo(0); // Number of shares/units
    table.timestamps(true, true);

    // Foreign key constraint to portfolios table
    table
      .foreign("portfolio_id")
      .references("id")
      .inTable("portfolios")
      .onDelete("CASCADE");

    // Composite unique constraint to prevent duplicate holdings per portfolio per market
    table.unique(["portfolio_id", "market_id"]);

    // Indexes for performance
    table.index("portfolio_id");
    table.index("market_id");
    table.index(["portfolio_id", "market_id"]);
    table.index("created_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("holdings");
}
