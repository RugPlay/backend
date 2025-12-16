import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { HoldingsProductionDto, HoldingsProductionQueryDto } from "../dtos/holdings/holdings-production.dto";
import { HoldingsGrowthDto } from "../dtos/holdings/holdings-growth.dto";
import { TimeBucketInterval } from "../dtos/shared/time-bucket.dto";
import { sql } from "kysely";

@Injectable()
export class HoldingsAnalyticsDao extends KyselyDao<HoldingsAnalyticsDao> {
  /**
   * Get holdings production rate data (created/removed over time)
   * Note: This tracks holdings created_at timestamps. For removed holdings,
   * we track when quantity becomes zero or holdings are deleted.
   */
  async getHoldingsProductionData(
    query: HoldingsProductionQueryDto,
  ): Promise<HoldingsProductionDto[]> {
    try {
      // Build WHERE conditions for created query
      const createdConditions: any[] = [];
      
      if (query.userId) {
        createdConditions.push(sql`user_id = ${query.userId}`);
      }
      
      if (query.assetId) {
        createdConditions.push(sql`asset_id = ${query.assetId}`);
      }

      if (query.startTime) {
        createdConditions.push(sql`created_at >= ${query.startTime}`);
      }

      if (query.endTime) {
        createdConditions.push(sql`created_at <= ${query.endTime}`);
      }

      // Query for holdings created (using created_at)
      const createdQuery = sql`
        SELECT 
          time_bucket(${sql.literal(query.interval)}::interval, created_at) AS timestamp,
          COUNT(*) AS created
        FROM holdings
        ${createdConditions.length > 0 ? sql`WHERE ${sql.join(createdConditions, sql` AND `)}` : sql``}
        GROUP BY time_bucket(${sql.literal(query.interval)}::interval, created_at)
      `;

      // Query for holdings removed (quantity = 0)
      const removedConditions: any[] = [sql`quantity = 0`];
      
      if (query.userId) {
        removedConditions.push(sql`user_id = ${query.userId}`);
      }
      
      if (query.assetId) {
        removedConditions.push(sql`asset_id = ${query.assetId}`);
      }

      if (query.startTime) {
        removedConditions.push(sql`updated_at >= ${query.startTime}`);
      }

      if (query.endTime) {
        removedConditions.push(sql`updated_at <= ${query.endTime}`);
      }

      const removedQuery = sql`
        SELECT 
          time_bucket(${sql.literal(query.interval)}::interval, updated_at) AS timestamp,
          COUNT(*) AS removed
        FROM holdings
        WHERE ${sql.join(removedConditions, sql` AND `)}
        GROUP BY time_bucket(${sql.literal(query.interval)}::interval, updated_at)
      `;

      // Execute both queries
      const [createdResults, removedResults] = await Promise.all([
        createdQuery.execute(this.kysely),
        removedQuery.execute(this.kysely),
      ]);

      // Handle QueryResult - it might be an array or have a rows property
      const createdRows = Array.isArray(createdResults) 
        ? createdResults 
        : (createdResults as any)?.rows || (createdResults as any) || [];
      const removedRows = Array.isArray(removedResults) 
        ? removedResults 
        : (removedResults as any)?.rows || (removedResults as any) || [];

      // Create maps for quick lookup
      const createdMap = new Map<string, number>();
      createdRows.forEach((row: any) => {
        if (row?.timestamp) {
          createdMap.set(new Date(row.timestamp).toISOString(), parseInt(row.created, 10));
        }
      });

      const removedMap = new Map<string, number>();
      removedRows.forEach((row: any) => {
        if (row?.timestamp) {
          removedMap.set(new Date(row.timestamp).toISOString(), parseInt(row.removed, 10));
        }
      });

      // Get all unique timestamps
      const allTimestamps = new Set([
        ...Array.from(createdMap.keys()),
        ...Array.from(removedMap.keys()),
      ]);

      // Build result array
      const result: HoldingsProductionDto[] = [];
      let runningTotal = 0;

      // Get initial total holdings count (before startTime if specified)
      const initialConditions: any[] = [];
      
      if (query.userId) {
        initialConditions.push(sql`user_id = ${query.userId}`);
      }
      
      if (query.assetId) {
        initialConditions.push(sql`asset_id = ${query.assetId}`);
      }

      if (query.startTime) {
        initialConditions.push(sql`created_at < ${query.startTime}`);
      }

      const initialCountQuery = sql`
        SELECT COUNT(*) as total
        FROM holdings
        ${initialConditions.length > 0 ? sql`WHERE ${sql.join(initialConditions, sql` AND `)}` : sql``}
      `;

      const initialResult = await initialCountQuery.execute(this.kysely);
      const initialRows = Array.isArray(initialResult) 
        ? initialResult 
        : (initialResult as any)?.rows || (initialResult as any) || [];
      runningTotal = initialRows && initialRows.length > 0
        ? parseInt(initialRows[0].total, 10)
        : 0;

      // Sort timestamps
      const sortedTimestamps = Array.from(allTimestamps).sort();

      for (const timestampStr of sortedTimestamps) {
        const timestamp = new Date(timestampStr);
        const created = createdMap.get(timestampStr) || 0;
        const removed = removedMap.get(timestampStr) || 0;
        const netChange = created - removed;
        
        runningTotal += netChange;

        result.push({
          timestamp,
          created,
          removed,
          netChange,
          totalHoldings: runningTotal,
        });

        if (query.limit && result.length >= query.limit) {
          break;
        }
      }

      return result;
    } catch (error) {
      console.error("Error fetching holdings production data:", error);
      return [];
    }
  }

  /**
   * Get holdings growth data (quantity changes over time)
   */
  async getHoldingsGrowthData(
    interval: TimeBucketInterval,
    userId?: string,
    assetId?: string,
    startTime?: Date,
    endTime?: Date,
    limit?: number,
  ): Promise<HoldingsGrowthDto[]> {
    try {
      // Build WHERE conditions
      const conditions: any[] = [];
      
      if (userId) {
        conditions.push(sql`user_id = ${userId}`);
      }
      
      if (assetId) {
        conditions.push(sql`asset_id = ${assetId}`);
      }

      if (startTime) {
        conditions.push(sql`updated_at >= ${startTime}`);
      }

      if (endTime) {
        conditions.push(sql`updated_at <= ${endTime}`);
      }

      // Query to get quantity changes over time
      // We'll track the sum of quantities at each time bucket
      let query = sql`
        SELECT 
          time_bucket(${sql.literal(interval)}::interval, updated_at) AS timestamp,
          SUM(quantity) AS total_quantity,
          SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) AS quantity_added,
          SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) AS quantity_removed
        FROM holdings
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        GROUP BY time_bucket(${sql.literal(interval)}::interval, updated_at)
        ORDER BY timestamp ASC
      `;

      if (limit) {
        query = sql`${query} LIMIT ${limit}`;
      }

      const results = await query.execute(this.kysely);
      
      // Handle QueryResult - it might be an array or have a rows property
      const rows = Array.isArray(results) 
        ? results 
        : (results as any)?.rows || (results as any) || [];

      let previousQuantity = 0;
      return rows.map((row: any) => {
        const totalQuantity = parseFloat(row.total_quantity) || 0;
        const quantityAdded = parseFloat(row.quantity_added) || 0;
        const quantityRemoved = parseFloat(row.quantity_removed) || 0;
        const netQuantityChange = quantityAdded - quantityRemoved;
        
        const growthRate = previousQuantity !== 0
          ? ((netQuantityChange / previousQuantity) * 100)
          : 0;

        previousQuantity = totalQuantity;

        return {
          timestamp: row.timestamp as Date,
          totalQuantity,
          quantityAdded,
          quantityRemoved,
          netQuantityChange,
          growthRate,
        };
      });
    } catch (error) {
      console.error("Error fetching holdings growth data:", error);
      return [];
    }
  }

  /**
   * Get total holdings count at a specific point in time
   */
  async getTotalHoldingsCount(
    userId?: string,
    assetId?: string,
    atTime?: Date,
  ): Promise<number> {
    try {
      let query = this.kysely
        .selectFrom("holdings")
        .select(sql<number>`COUNT(*)`.as("count"));

      if (userId) {
        query = query.where("user_id", "=", userId);
      }

      if (assetId) {
        query = query.where("asset_id", "=", assetId);
      }

      if (atTime) {
        query = query.where("created_at", "<=", atTime);
      }

      const result = await query.executeTakeFirst();
      if (!result) {
        return 0;
      }
      const countValue = (result as any).count;
      if (typeof countValue === "number") {
        return countValue;
      }
      if (typeof countValue === "string") {
        return parseInt(countValue, 10) || 0;
      }
      return 0;
    } catch (error) {
      console.error("Error fetching total holdings count:", error);
      return 0;
    }
  }
}

