import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add average cost basis column (average price paid per unit)
  await db.schema
    .alterTable('holdings')
    .addColumn('average_cost_basis', sql`decimal(20,8)`, (col) => col.defaultTo('0'))
    .execute();

  // Add total cost column (total amount paid for all holdings)
  await db.schema
    .alterTable('holdings')
    .addColumn('total_cost', sql`decimal(20,8)`, (col) => col.defaultTo('0'))
    .execute();

  // Update existing holdings to have 0 cost basis (they were created before cost tracking)
  await db
    .updateTable('holdings')
    .set({
      average_cost_basis: '0',
      total_cost: '0',
    })
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('holdings')
    .dropColumn('average_cost_basis')
    .execute();

  await db.schema
    .alterTable('holdings')
    .dropColumn('total_cost')
    .execute();
}

