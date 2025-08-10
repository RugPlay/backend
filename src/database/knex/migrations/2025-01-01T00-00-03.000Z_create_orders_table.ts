import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("orders", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("market_id")
      .notNullable()
      .references("id")
      .inTable("markets")
      .onDelete("CASCADE");
    table
      .uuid("portfolio_id")
      .notNullable()
      .references("id")
      .inTable("portfolios")
      .onDelete("CASCADE");
    table.enum("side", ["bid", "ask"]).notNullable();
    table.decimal("price", 20, 8).notNullable(); // Support high precision prices
    table.decimal("quantity", 20, 8).notNullable(); // Support high precision quantities
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    // Composite index for efficient order book queries
    table.index(["market_id", "side", "price"]);

    // Index for efficient portfolio-based queries
    table.index(["portfolio_id"]);

    // Index for order lookup by ID
    table.index(["id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("orders");
}
