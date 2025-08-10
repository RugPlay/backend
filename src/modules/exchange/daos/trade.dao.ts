import { Injectable } from "@nestjs/common";
import { KnexDao } from "@/database/knex/knex.dao";
import { TradeExecutionDto } from "../dtos/trade/trade-execution.dto";

export interface TradeRecord {
  id: string;
  trade_id: string;
  market_id: string;
  taker_order_id: string;
  maker_order_id: string;
  taker_side: "bid" | "ask";
  quantity: string; // Decimal as string from database
  price: string; // Decimal as string from database
  taker_user_id?: string;
  maker_user_id?: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class TradeDao extends KnexDao<TradeDao> {
  protected readonly tableName = "trades";

  /**
   * Insert a new trade execution into the database
   */
  async createTrade(trade: TradeExecutionDto): Promise<string | null> {
    try {
      const [result] = await this.knex(this.tableName)
        .insert({
          trade_id: trade.tradeId,
          market_id: trade.marketId,
          taker_order_id: trade.takerOrderId,
          maker_order_id: trade.makerOrderId,
          taker_side: trade.takerSide,
          quantity: trade.quantity.toString(),
          price: trade.price.toString(),
          taker_user_id: trade.takerUserId,
          maker_user_id: trade.makerUserId,
        })
        .returning("id");

      return result?.id || null;
    } catch (error) {
      console.error("Error creating trade:", error);
      return null;
    }
  }

  /**
   * Get all trades for a specific market
   */
  async getTradesByMarket(marketId: string): Promise<TradeRecord[]> {
    try {
      return await this.knex(this.tableName)
        .where("market_id", marketId)
        .orderBy("created_at", "desc");
    } catch (error) {
      console.error("Error fetching trades by market:", error);
      return [];
    }
  }

  /**
   * Get recent trades for a market with pagination
   */
  async getRecentTrades(
    marketId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<TradeRecord[]> {
    try {
      return await this.knex(this.tableName)
        .where("market_id", marketId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error("Error fetching recent trades:", error);
      return [];
    }
  }

  /**
   * Get trades within a time range
   */
  async getTradesByTimeRange(
    marketId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<TradeRecord[]> {
    try {
      return await this.knex(this.tableName)
        .where("market_id", marketId)
        .whereBetween("created_at", [startTime, endTime])
        .orderBy("created_at", "desc");
    } catch (error) {
      console.error("Error fetching trades by time range:", error);
      return [];
    }
  }

  /**
   * Get the last trade price for a market
   */
  async getLastTradePrice(marketId: string): Promise<number | null> {
    try {
      const result = await this.knex(this.tableName)
        .where("market_id", marketId)
        .orderBy("created_at", "desc")
        .select("price")
        .first();

      return result ? parseFloat(result.price) : null;
    } catch (error) {
      console.error("Error fetching last trade price:", error);
      return null;
    }
  }

  /**
   * Delete trades older than a specific date
   */
  async deleteOldTrades(olderThan: Date): Promise<number> {
    try {
      return await this.knex(this.tableName)
        .where("created_at", "<", olderThan)
        .delete();
    } catch (error) {
      console.error("Error deleting old trades:", error);
      return 0;
    }
  }
}
