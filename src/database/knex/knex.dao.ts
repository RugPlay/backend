import { Knex } from "knex";
import { InjectConnection } from "nest-knexjs";
import { BaseTransaction } from "@/database/base.transaction";
import { Injectable } from "@nestjs/common";

@Injectable()
export abstract class KnexDao<T extends KnexDao<T>> {
  constructor(@InjectConnection() protected readonly knex: Knex) {}

  async transaction<R>(
    callback: (transaction: BaseTransaction<Knex.Transaction>) => Promise<R>,
  ) {
    return await this.knex.transaction(async (knexTransaction) => {
      const baseTransaction = new BaseTransaction(knexTransaction);
      return callback(baseTransaction);
    });
  }

  transacting(transaction: BaseTransaction<Knex.Transaction>): T {
    // Create a new instance of the same class with the transaction knex
    const TransactionalClass = this.constructor as new (knex: Knex) => T;
    return new TransactionalClass(transaction.instance());
  }
}
