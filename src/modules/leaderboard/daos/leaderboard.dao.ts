import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { sql } from "kysely";

export interface LeaderboardEntry {
  corporation_id: string;
  corporation_name: string;
  current_influence: number;
}

@Injectable()
export class LeaderboardDao extends KyselyDao<LeaderboardDao> {
  /**
   * Validate and sanitize limit parameter
   */
  private validateLimit(limit: number | undefined, defaultLimit: number = 100, maxLimit: number = 1000): number {
    if (typeof limit !== 'number' || isNaN(limit) || limit < 1) {
      return defaultLimit;
    }
    return Math.min(Math.floor(limit), maxLimit);
  }
  /**
   * Get current influence leaderboard calculated from events (single source of truth)
   */
  async getCurrentInfluenceLeaderboard(
    limit: number,
    deteriorationAmount: number,
    intervalSeconds: number,
  ): Promise<LeaderboardEntry[]> {
    try {
      const safeLimit = this.validateLimit(limit, 100, 1000);

      // Calculate current influence from latest events with deterioration
      const query = sql`
        WITH latest_events AS (
          SELECT DISTINCT ON (corporation_id)
            corporation_id,
            balance_after,
            created_at
          FROM influence_events
          ORDER BY corporation_id, created_at DESC
        )
        SELECT 
          c.id as corporation_id,
          c.name as corporation_name,
          GREATEST(0, 
            COALESCE(le.balance_after::numeric, 0) - 
            FLOOR(
              EXTRACT(EPOCH FROM (NOW() - COALESCE(le.created_at, c.created_at))) / 
              ${intervalSeconds}
            ) * ${deteriorationAmount}
          ) as current_influence
        FROM corporations c
        LEFT JOIN latest_events le ON le.corporation_id = c.id
        WHERE c.is_active = true
        ORDER BY current_influence DESC
        LIMIT ${safeLimit}
      `;

      const results = await query.execute(this.kysely);
      const rows = Array.isArray(results) ? results : (results as any)?.rows || [];

      return rows.map((row: any) => ({
        corporation_id: row.corporation_id,
        corporation_name: row.corporation_name,
        current_influence: parseFloat(row.current_influence?.toString() || '0'),
      }));
    } catch (error) {
      console.error("Error fetching current influence leaderboard:", error);
      return [];
    }
  }

  /**
   * Get all-time influence leaderboard (highest influence ever achieved)
   * Queries events table without joins for performance
   */
  async getAllTimeInfluenceLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
    try {
      const safeLimit = this.validateLimit(limit, 100, 1000);

      // Step 1: Get max influence per corporation from events (no join)
      const maxInfluenceQuery = sql`
        SELECT 
          corporation_id,
          MAX(balance_after::numeric) as max_influence
        FROM influence_events
        WHERE event_type = 'purchase'
        GROUP BY corporation_id
        ORDER BY MAX(balance_after::numeric) DESC
        LIMIT ${safeLimit}
      `;

      const maxResults = await maxInfluenceQuery.execute(this.kysely);
      const rows = Array.isArray(maxResults) ? maxResults : (maxResults as any)?.rows || [];

      if (rows.length === 0) return [];

      // Step 2: Get corporation IDs
      const corporationIds = rows.map((r: any) => r.corporation_id);

      // Step 3: Query corporations separately (fast IN lookup with index, no join)
      const corporations = await this.kysely
        .selectFrom("corporations")
        .select(["id", "name"])
        .where("id", "in", corporationIds)
        .where("is_active", "=", true)
        .execute();

      // Step 4: Merge in application code
      const corporationMap = new Map(corporations.map((c: any) => [c.id, c.name]));

      return rows
        .map((row: any) => ({
          corporation_id: row.corporation_id,
          corporation_name: corporationMap.get(row.corporation_id) || "Unknown",
          current_influence: parseFloat(row.max_influence?.toString() || "0"),
        }))
        .filter((entry) => entry.corporation_name !== "Unknown");
    } catch (error) {
      console.error("Error fetching all-time influence leaderboard:", error);
      return [];
    }
  }

  /**
   * Get 24-hour influence leaderboard (highest influence in last 24 hours)
   * Queries events table without joins for performance
   */
  async get24HourInfluenceLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
    try {
      const safeLimit = this.validateLimit(limit, 100, 1000);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Step 1: Get max influence from events in time window (no join)
      const maxInfluenceQuery = sql`
        SELECT 
          corporation_id,
          MAX(balance_after::numeric) as max_influence
        FROM influence_events
        WHERE event_type = 'purchase'
          AND created_at >= ${twentyFourHoursAgo}
        GROUP BY corporation_id
        ORDER BY MAX(balance_after::numeric) DESC
        LIMIT ${safeLimit}
      `;

      const maxResults = await maxInfluenceQuery.execute(this.kysely);
      const rows = Array.isArray(maxResults) ? maxResults : (maxResults as any)?.rows || [];

      if (rows.length === 0) return [];

      // Step 2: Get corporation IDs
      const corporationIds = rows.map((r: any) => r.corporation_id);

      // Step 3: Query corporations separately (fast IN lookup with index, no join)
      const corporations = await this.kysely
        .selectFrom("corporations")
        .select(["id", "name"])
        .where("id", "in", corporationIds)
        .where("is_active", "=", true)
        .execute();

      // Step 4: Merge in application code
      const corporationMap = new Map(corporations.map((c: any) => [c.id, c.name]));

      return rows
        .map((row: any) => ({
          corporation_id: row.corporation_id,
          corporation_name: corporationMap.get(row.corporation_id) || "Unknown",
          current_influence: parseFloat(row.max_influence?.toString() || "0"),
        }))
        .filter((entry) => entry.corporation_name !== "Unknown");
    } catch (error) {
      console.error("Error fetching 24-hour influence leaderboard:", error);
      return [];
    }
  }

  /**
   * Get weekly (7-day) influence leaderboard (highest influence in last 7 days)
   * Queries events table without joins for performance
   */
  async getWeeklyInfluenceLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
    try {
      const safeLimit = this.validateLimit(limit, 100, 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Step 1: Get max influence from events in time window (no join)
      const maxInfluenceQuery = sql`
        SELECT 
          corporation_id,
          MAX(balance_after::numeric) as max_influence
        FROM influence_events
        WHERE event_type = 'purchase'
          AND created_at >= ${sevenDaysAgo}
        GROUP BY corporation_id
        ORDER BY MAX(balance_after::numeric) DESC
        LIMIT ${safeLimit}
      `;

      const maxResults = await maxInfluenceQuery.execute(this.kysely);
      const rows = Array.isArray(maxResults) ? maxResults : (maxResults as any)?.rows || [];

      if (rows.length === 0) return [];

      // Step 2: Get corporation IDs
      const corporationIds = rows.map((r: any) => r.corporation_id);

      // Step 3: Query corporations separately (fast IN lookup with index, no join)
      const corporations = await this.kysely
        .selectFrom("corporations")
        .select(["id", "name"])
        .where("id", "in", corporationIds)
        .where("is_active", "=", true)
        .execute();

      // Step 4: Merge in application code
      const corporationMap = new Map(corporations.map((c: any) => [c.id, c.name]));

      return rows
        .map((row: any) => ({
          corporation_id: row.corporation_id,
          corporation_name: corporationMap.get(row.corporation_id) || "Unknown",
          current_influence: parseFloat(row.max_influence?.toString() || "0"),
        }))
        .filter((entry) => entry.corporation_name !== "Unknown");
    } catch (error) {
      console.error("Error fetching weekly influence leaderboard:", error);
      return [];
    }
  }
}

