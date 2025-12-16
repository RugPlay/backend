import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { OhlcDto } from "../dtos/markets/ohlc.dto";
import { VolumeDto } from "../dtos/markets/volume.dto";
import { PriceChangeDto } from "../dtos/markets/price-change.dto";
import { TimeBucketInterval } from "../dtos/shared/time-bucket.dto";
import { sql } from "kysely";

@Injectable()
export class MarketsAnalyticsDao extends KyselyDao<MarketsAnalyticsDao> {
  /**
   * Get OHLC (Open, High, Low, Close) data for a market with time bucketing
   */
  async getOhlcData(
    marketId: string,
    interval: TimeBucketInterval,
    startTime?: Date,
    endTime?: Date,
    limit?: number,
  ): Promise<OhlcDto[]> {
    try {
      // Build WHERE conditions
      const conditions = [sql`market_id = ${marketId}`];
      if (startTime) {
        conditions.push(sql`created_at >= ${startTime}`);
      }
      if (endTime) {
        conditions.push(sql`created_at <= ${endTime}`);
      }

      // Build the query
      let query = sql`
        SELECT 
          time_bucket(${sql.literal(interval)}::interval, created_at) AS timestamp,
          (array_agg(price ORDER BY created_at ASC))[1] AS open,
          MAX(price) AS high,
          MIN(price) AS low,
          (array_agg(price ORDER BY created_at DESC))[1] AS close,
          SUM(quantity) AS volume,
          COUNT(*) AS trade_count
        FROM trades
        WHERE ${sql.join(conditions, sql` AND `)}
        GROUP BY time_bucket(${sql.literal(interval)}::interval, created_at)
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

      return rows.map((row: any) => ({
        timestamp: row.timestamp as Date,
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseFloat(row.volume),
        tradeCount: parseInt(row.trade_count, 10),
      }));
    } catch (error) {
      console.error("Error fetching OHLC data:", error);
      return [];
    }
  }

  /**
   * Get volume data for a market with time bucketing
   */
  async getVolumeData(
    marketId: string,
    interval: TimeBucketInterval,
    startTime?: Date,
    endTime?: Date,
    limit?: number,
  ): Promise<VolumeDto[]> {
    try {
      // Build WHERE conditions
      const conditions = [sql`market_id = ${marketId}`];
      if (startTime) {
        conditions.push(sql`created_at >= ${startTime}`);
      }
      if (endTime) {
        conditions.push(sql`created_at <= ${endTime}`);
      }

      // Build the query
      let query = sql`
        SELECT 
          time_bucket(${sql.literal(interval)}::interval, created_at) AS timestamp,
          SUM(quantity) AS volume,
          COUNT(*) AS trade_count
        FROM trades
        WHERE ${sql.join(conditions, sql` AND `)}
        GROUP BY time_bucket(${sql.literal(interval)}::interval, created_at)
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

      return rows.map((row: any) => ({
        timestamp: row.timestamp as Date,
        volume: parseFloat(row.volume),
        tradeCount: parseInt(row.trade_count, 10),
      }));
    } catch (error) {
      console.error("Error fetching volume data:", error);
      return [];
    }
  }

  /**
   * Get price change data over time for a market
   */
  async getPriceChangeData(
    marketId: string,
    interval: TimeBucketInterval,
    startTime?: Date,
    endTime?: Date,
    limit?: number,
  ): Promise<PriceChangeDto[]> {
    try {
      // First, get the OHLC data which includes close prices
      const ohlcData = await this.getOhlcData(
        marketId,
        interval,
        startTime,
        endTime,
        limit ? limit + 1 : undefined,
      );

      if (ohlcData.length === 0) {
        return [];
      }

      // Calculate price changes
      const priceChangeData: PriceChangeDto[] = [];
      for (let i = 0; i < ohlcData.length; i++) {
        const current = ohlcData[i];
        const previous = i > 0 ? ohlcData[i - 1] : null;

        const change = previous ? current.close - previous.close : 0;
        const changePercent = previous && previous.close !== 0
          ? ((current.close - previous.close) / previous.close) * 100
          : 0;

        priceChangeData.push({
          timestamp: current.timestamp,
          price: current.close,
          change,
          changePercent,
        });
      }

      // Remove the first data point if we fetched an extra one
      if (limit && priceChangeData.length > limit) {
        priceChangeData.shift();
      }

      return priceChangeData;
    } catch (error) {
      console.error("Error fetching price change data:", error);
      return [];
    }
  }

  /**
   * Get the latest price for a market
   */
  async getLatestPrice(marketId: string): Promise<number | null> {
    try {
      const result = await this.kysely
        .selectFrom("trades")
        .select("price")
        .where("market_id", "=", marketId)
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(1)
        .executeTakeFirst();

      return result ? parseFloat(result.price) : null;
    } catch (error) {
      console.error("Error fetching latest price:", error);
      return null;
    }
  }

  /**
   * Get 24-hour statistics for a market
   */
  async get24HourStats(marketId: string): Promise<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    tradeCount: number;
    change: number;
    changePercent: number;
  } | null> {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      // Use raw SQL for array_agg aggregate functions
      const query = sql`
        SELECT 
          (array_agg(price ORDER BY created_at ASC))[1] AS open,
          MAX(price) AS high,
          MIN(price) AS low,
          (array_agg(price ORDER BY created_at DESC))[1] AS close,
          SUM(quantity) AS volume,
          COUNT(*) AS trade_count
        FROM trades
        WHERE market_id = ${marketId}
          AND created_at >= ${twentyFourHoursAgo}
      `;

      const results = await query.execute(this.kysely);
      
      // Handle QueryResult - it might be an array or have a rows property
      const rows = Array.isArray(results) 
        ? results 
        : (results as any)?.rows || (results as any) || [];
      
      if (!rows || rows.length === 0) {
        return null;
      }

      const row = rows[0];
      const open = parseFloat(row.open);
      const close = parseFloat(row.close);
      const change = close - open;
      const changePercent = open !== 0 ? (change / open) * 100 : 0;

      return {
        open,
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close,
        volume: parseFloat(row.volume),
        tradeCount: parseInt(row.trade_count, 10),
        change,
        changePercent,
      };
    } catch (error) {
      console.error("Error fetching 24-hour stats:", error);
      return null;
    }
  }
}

