import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";

export interface InfluenceEvent {
  id: string;
  corporation_id: string;
  event_type: "purchase" | "spend";
  amount: number;
  balance_after: number;
  created_at: Date;
}

@Injectable()
export class InfluenceEventDao extends KyselyDao<InfluenceEventDao> {
  /**
   * Record an influence event (purchase or spend)
   */
  async recordEvent(
    corporationId: string,
    eventType: "purchase" | "spend",
    amount: number,
    balanceAfter: number,
  ): Promise<boolean> {
    try {
      await this.kysely
        .insertInto("influence_events" as any)
        .values({
          corporation_id: corporationId,
          event_type: eventType,
          amount: amount.toString(),
          balance_after: balanceAfter.toString(),
        } as any)
        .execute();

      return true;
    } catch (error) {
      console.error("Error recording influence event:", error);
      return false;
    }
  }

  /**
   * Get the latest influence event for a corporation
   */
  async getLatestEvent(corporationId: string): Promise<InfluenceEvent | null> {
    try {
      const query = this.kysely
        .selectFrom("influence_events" as any)
        .selectAll() as any;
      const result = await query
        .where("corporation_id", "=", corporationId)
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst();

      if (!result) {
        return null;
      }

      return {
        id: result.id,
        corporation_id: result.corporation_id,
        event_type: result.event_type as "purchase" | "spend",
        amount: parseFloat(result.amount?.toString() || "0"),
        balance_after: parseFloat(result.balance_after?.toString() || "0"),
        created_at: result.created_at,
      };
    } catch (error) {
      console.error("Error getting latest influence event:", error);
      return null;
    }
  }
}

