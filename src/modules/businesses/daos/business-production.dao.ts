import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { sql } from "kysely";

export interface BusinessProductionRecord {
  id: string;
  business_id: string;
  accumulated_time: number;
  last_updated: Date;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class BusinessProductionDao extends KyselyDao<BusinessProductionDao> {
  /**
   * Get or create production record for a business
   */
  async getOrCreateProduction(businessId: string): Promise<BusinessProductionRecord | null> {
    try {
      // Try to get existing record
      const selectQuery = this.kysely
        .selectFrom("business_production" as any)
        .selectAll() as any;
      let record = await selectQuery.where("business_id", "=", businessId).executeTakeFirst();

      // If not found, create one
      if (!record) {
        const result = await this.kysely
          .insertInto("business_production" as any)
          .values({
            business_id: businessId,
            accumulated_time: 0,
          } as any)
          .returningAll()
          .executeTakeFirst();

        record = result;
      }

      return record as BusinessProductionRecord | null;
    } catch (error) {
      console.error("Error getting/creating business production:", error);
      return null;
    }
  }

  /**
   * Add time to business production
   */
  async addTime(businessId: string, timeSeconds: number): Promise<boolean> {
    try {
      // Ensure record exists
      await this.getOrCreateProduction(businessId);

      const updateQuery = this.kysely
        .updateTable("business_production" as any)
        .set({
          accumulated_time: sql`accumulated_time + ${timeSeconds}`,
          last_updated: sql`now()`,
          updated_at: sql`now()`,
        } as any) as any;
      const result = await updateQuery.where("business_id", "=", businessId).executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error adding production time:", error);
      return false;
    }
  }

  /**
   * Consume accumulated time (when claiming outputs)
   */
  async consumeTime(businessId: string, timeSeconds: number): Promise<boolean> {
    try {
      const updateQuery = this.kysely
        .updateTable("business_production" as any)
        .set({
          accumulated_time: sql`GREATEST(0, accumulated_time - ${timeSeconds})`,
          updated_at: sql`now()`,
        } as any) as any;
      const result = await updateQuery.where("business_id", "=", businessId).executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error consuming production time:", error);
      return false;
    }
  }

  /**
   * Get current accumulated time
   */
  async getAccumulatedTime(businessId: string): Promise<number> {
    try {
      const record = await this.getOrCreateProduction(businessId);
      return record?.accumulated_time || 0;
    } catch (error) {
      console.error("Error getting accumulated time:", error);
      return 0;
    }
  }

  /**
   * Reset production (for testing or manual reset)
   */
  async resetProduction(businessId: string): Promise<boolean> {
    try {
      const updateQuery = this.kysely
        .updateTable("business_production" as any)
        .set({
          accumulated_time: 0,
          last_updated: sql`now()`,
          updated_at: sql`now()`,
        } as any) as any;
      const result = await updateQuery.where("business_id", "=", businessId).executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error resetting production:", error);
      return false;
    }
  }
}

