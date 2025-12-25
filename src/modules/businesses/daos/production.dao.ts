import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { sql } from "kysely";

export interface Production {
  id: string;
  business_id: string;
  cycles: number;
  cycles_remaining: number;
  input_quantities: Record<string, number>;
  production_started_at: Date;
  cycle_completion_time: number;
  status: "active" | "completed" | "claimed";
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class ProductionDao extends KyselyDao<ProductionDao> {
  /**
   * Create a new production batch
   */
  async createBatch(
    businessId: string,
    cycles: number,
    inputQuantities: Record<string, number>,
    cycleCompletionTime: number
  ): Promise<string | null> {
    try {
      const result = await this.kysely
        .insertInto("production" as any)
        .values({
          business_id: businessId,
          cycles,
          cycles_remaining: cycles,
          input_quantities: inputQuantities,
          production_started_at: sql`now()`,
          cycle_completion_time: cycleCompletionTime,
          status: "active",
        } as any)
        .returning("id")
        .executeTakeFirst();

      return result?.id || null;
    } catch (error) {
      console.error("Error creating production batch:", error);
      return null;
    }
  }

  /**
   * Get all active batches for a business
   */
  async getActiveBatches(businessId: string): Promise<Production[]> {
    try {
      const query = this.kysely
        .selectFrom("production" as any)
        .selectAll() as any;
      const batches = await query
        .where("business_id", "=", businessId)
        .where("status", "=", "active")
        .orderBy("production_started_at", "asc")
        .execute();

      return (batches || []).map((batch) => this.mapRecordToBatch(batch));
    } catch (error) {
      console.error("Error getting active batches:", error);
      return [];
    }
  }

  /**
   * Get all batches for a business (any status)
   */
  async getBatchesByBusinessId(businessId: string): Promise<Production[]> {
    try {
      const query = this.kysely
        .selectFrom("production" as any)
        .selectAll() as any;
      const batches = await query
        .where("business_id", "=", businessId)
        .orderBy("production_started_at", "desc")
        .execute();

      return (batches || []).map((batch) => this.mapRecordToBatch(batch));
    } catch (error) {
      console.error("Error getting batches by business ID:", error);
      return [];
    }
  }

  /**
   * Get batches with available cycles (completed or partially completed)
   */
  async getBatchesWithAvailableCycles(businessId: string): Promise<Production[]> {
    try {
      const query = this.kysely
        .selectFrom("production" as any)
        .selectAll() as any;
      const batches = await query
        .where("business_id", "=", businessId)
        .where("status", "in", ["active", "completed"])
        .where("cycles_remaining", ">", 0)
        .orderBy("production_started_at", "asc") // FIFO - oldest first
        .execute();

      return (batches || []).map((batch) => this.mapRecordToBatch(batch));
    } catch (error) {
      console.error("Error getting batches with available cycles:", error);
      return [];
    }
  }

  /**
   * Update batch cycles remaining
   */
  async updateBatchCycles(batchId: string, cyclesRemaining: number): Promise<boolean> {
    try {
      const status = cyclesRemaining === 0 ? "claimed" : "active";
      
      const updateQuery = this.kysely
        .updateTable("production" as any)
        .set({
          cycles_remaining: cyclesRemaining,
          status,
          updated_at: sql`now()`,
        } as any) as any;
      const result = await updateQuery
        .where("id", "=", batchId)
        .executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error updating batch cycles:", error);
      return false;
    }
  }

  /**
   * Mark batch as completed (when all cycles are done but not yet claimed)
   */
  async markBatchCompleted(batchId: string): Promise<boolean> {
    try {
      const updateQuery = this.kysely
        .updateTable("production" as any)
        .set({
          status: "completed",
          updated_at: sql`now()`,
        } as any) as any;
      const result = await updateQuery
        .where("id", "=", batchId)
        .executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error marking batch as completed:", error);
      return false;
    }
  }

  /**
   * Get batch by ID
   */
  async getBatchById(batchId: string): Promise<Production | null> {
    try {
      const query = this.kysely
        .selectFrom("production" as any)
        .selectAll() as any;
      const batch = await query
        .where("id", "=", batchId)
        .executeTakeFirst();

      return batch ? this.mapRecordToBatch(batch) : null;
    } catch (error) {
      console.error("Error getting batch by ID:", error);
      return null;
    }
  }

  /**
   * Map database record to Production
   */
  private mapRecordToBatch(record: any): Production {
    return {
      id: record.id,
      business_id: record.business_id,
      cycles: record.cycles,
      cycles_remaining: record.cycles_remaining,
      input_quantities: record.input_quantities || {},
      production_started_at: record.production_started_at,
      cycle_completion_time: record.cycle_completion_time,
      status: record.status,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }
}

