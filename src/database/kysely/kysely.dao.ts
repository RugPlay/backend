import { Kysely, Transaction } from 'kysely';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { BaseTransaction } from '@/database/base-transaction';
import { DB } from '../types/db';

@Injectable()
export abstract class KyselyDao<T extends KyselyDao<T>> {
  constructor(@InjectKysely() protected readonly kysely: Kysely<DB>) {}

  async transaction<R>(
    callback: (transaction: BaseTransaction<Transaction<DB>>) => Promise<R>,
  ): Promise<R> {
    return await this.kysely.transaction().execute(async (kyselyTransaction) => {
      const baseTransaction = new BaseTransaction(kyselyTransaction);
      return callback(baseTransaction);
    });
  }

  transacting(transaction: BaseTransaction<Transaction<DB>>): T {
    // Create a new instance with the transaction
    const Constructor = this.constructor as new (kysely: Kysely<DB>) => T;
    return new Constructor(transaction.instance() as Kysely<DB>);
  }
}