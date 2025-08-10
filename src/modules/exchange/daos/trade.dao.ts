import { Injectable } from "@nestjs/common";
import { KnexDao } from "@/database/knex/knex.dao";
import { TradeExecutionDto } from "../dtos/trade/trade-execution.dto";
import { TradeDto } from "../dtos/trade/trade.dto";
import { BatchCreateTradeDto } from "../dtos/trade/batch-create-trade.dto";
import { BatchTradeOperationResultDto } from "../dtos/trade/batch-trade-operation-result.dto";
import { TradeType } from "../types/trade-type";
import { v4 as uuidv4 } from "uuid";

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
          type: trade.type,
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
  async getTradesByMarket(marketId: string): Promise<TradeDto[]> {
    try {
      const results = await this.knex(this.tableName)
        .where("market_id", marketId)
        .orderBy("created_at", "desc");
      return results.map((record) => this.mapRecordToDto(record));
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
  ): Promise<TradeDto[]> {
    try {
      const results = await this.knex(this.tableName)
        .where("market_id", marketId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset);
      return results.map((record) => this.mapRecordToDto(record));
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
  ): Promise<TradeDto[]> {
    try {
      const results = await this.knex(this.tableName)
        .where("market_id", marketId)
        .whereBetween("created_at", [startTime, endTime])
        .orderBy("created_at", "desc");
      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching trades by time range:", error);
      return [];
    }
  }

  /**
   * Get trades by market and type
   */
  async getTradesByMarketAndType(
    marketId: string,
    type: TradeType,
    limit: number = 50,
    offset: number = 0,
  ): Promise<TradeDto[]> {
    try {
      const results = await this.knex(this.tableName)
        .where("market_id", marketId)
        .where("type", type)
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset);
      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching trades by market and type:", error);
      return [];
    }
  }

  /**
   * Get the last trade price for a market, optionally filtered by type
   */
  async getLastTradePrice(
    marketId: string,
    type?: TradeType,
  ): Promise<number | null> {
    try {
      let query = this.knex(this.tableName).where("market_id", marketId);

      if (type) {
        query = query.where("type", type);
      }

      const result = await query
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

  /**
   * Batch create multiple trades efficiently
   */
  async batchCreateTrades(
    trades: BatchCreateTradeDto[],
  ): Promise<BatchTradeOperationResultDto> {
    if (trades.length === 0) {
      return {
        tradesCreated: 0,
        createdTradeIds: [],
      };
    }

    try {
      // Convert BatchCreateTradeDto to database format
      const tradeRecords = trades.map((trade) => ({
        trade_id: trade.tradeId,
        market_id: trade.marketId,
        taker_order_id: trade.takerOrderId,
        maker_order_id: trade.makerOrderId,
        taker_side: trade.takerSide,
        type: trade.type,
        quantity: trade.quantity.toString(),
        price: trade.price.toString(),
        created_at: trade.timestamp,
      }));

      // Perform batch insert
      const results = await this.knex(this.tableName)
        .insert(tradeRecords)
        .returning("trade_id");

      const createdTradeIds =
        results?.map((r) => r.trade_id) || trades.map((t) => t.tradeId);

      return {
        tradesCreated: tradeRecords.length,
        createdTradeIds,
      };
    } catch (error) {
      console.error("Error in batch create trades:", error);
      return {
        tradesCreated: 0,
        createdTradeIds: [],
      };
    }
  }

  /**
   * Convert MatchResultDto to BatchCreateTradeDto for batch processing
   */
  createBatchTradeDto(
    marketId: string,
    takerOrderId: string,
    makerOrderId: string,
    takerSide: "bid" | "ask",
    type: TradeType,
    quantity: number,
    price: number,
    timestamp: Date = new Date(),
  ): BatchCreateTradeDto {
    return {
      tradeId: uuidv4(),
      marketId,
      takerOrderId,
      makerOrderId,
      takerSide,
      type,
      quantity,
      price,
      timestamp,
    };
  }

  /**
   * Map database record to TradeDto
   */
  private mapRecordToDto(record: any): TradeDto {
    const dto = new TradeDto();
    dto.id = record.id;
    dto.tradeId = record.trade_id;
    dto.marketId = record.market_id;
    dto.takerOrderId = record.taker_order_id;
    dto.makerOrderId = record.maker_order_id;
    dto.takerSide = record.taker_side;
    dto.type = record.type;
    dto.quantity = parseFloat(record.quantity);
    dto.price = parseFloat(record.price);
    dto.takerUserId = record.taker_user_id;
    dto.makerUserId = record.maker_user_id;
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    return dto;
  }
}
