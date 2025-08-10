import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable("orders", (table) => {
    table
      .uuid("portfolio_id")
      .notNullable()
      .references("id")
      .inTable("portfolios")
      .onDelete("CASCADE");
    
    // Add index for efficient portfolio-based queries
    table.index(["portfolio_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable("orders", (table) => {
    table.dropIndex(["portfolio_id"]);
    table.dropColumn("portfolio_id");
  });
}
