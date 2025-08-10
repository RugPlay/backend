import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("markets", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("symbol").notNullable().unique(); // e.g., "BTC-USD", "EUR-USD", "GOLD"
    table.string("name").notNullable(); // e.g., "Bitcoin/US Dollar", "Euro/US Dollar", "Gold"
    table
      .enum("category", [
        "futures",
        "commodities",
        "forex",
        "crypto",
        "stocks",
        "indices",
        "bonds",
      ])
      .notNullable();
    table.string("subcategory").nullable(); // e.g., "energy", "metals", "major", "altcoin"
    table.string("base_currency").notNullable(); // e.g., "BTC", "EUR", "GOLD"
    table.string("quote_currency").notNullable(); // e.g., "USD", "JPY", "EUR"
    table.decimal("min_price_increment", 20, 8).notNullable().defaultTo("0.01"); // Minimum price movement
    table
      .decimal("min_quantity_increment", 20, 8)
      .notNullable()
      .defaultTo("0.00000001"); // Minimum quantity
    table.decimal("max_quantity", 20, 8).nullable(); // Maximum order quantity
    table.boolean("is_active").notNullable().defaultTo(true); // Whether trading is enabled
    table.boolean("is_24h").notNullable().defaultTo(false); // Whether market trades 24/7
    table.time("trading_start").nullable(); // Trading session start time
    table.time("trading_end").nullable(); // Trading session end time
    table.string("timezone").nullable().defaultTo("UTC"); // Trading session timezone
    table.jsonb("metadata").nullable(); // Additional market-specific data
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    // Indexes for efficient queries
    table.index(["category", "subcategory"]);
    table.index(["base_currency", "quote_currency"]);
    table.index(["is_active"]);
    table.index(["symbol"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("markets");
}
