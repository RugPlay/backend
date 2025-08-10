import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("trades", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("trade_id").notNullable().unique();
    table.string("market_id").notNullable();
    table.string("taker_order_id").notNullable(); // The incoming order that triggered the match
    table.string("maker_order_id").notNullable(); // The existing order that was matched
    table.enum("taker_side", ["bid", "ask"]).notNullable(); // Whether taker was buying or selling
    table.enum("type", ["paper", "real"]).notNullable().defaultTo("real"); // Trade type
    table.decimal("quantity", 20, 8).notNullable();
    table.decimal("price", 20, 8).notNullable();
    table.string("taker_user_id").nullable();
    table.string("maker_user_id").nullable();
    table.timestamps(true, true);

    // Indexes for performance
    table.index("market_id");
    table.index("trade_id");
    table.index(["market_id", "created_at"]);
    table.index("taker_order_id");
    table.index("maker_order_id");
    table.index("taker_side");
    table.index(["market_id", "taker_side"]);
    table.index("type");
    table.index(["market_id", "type"]);
    table.index("created_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("trades");
}
