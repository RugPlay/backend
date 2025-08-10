import { Injectable } from "@nestjs/common";
import { KnexDao } from "@/database/knex/knex.dao";
import { CreateMarketDto } from "../dtos/market/create-market.dto";
import { UpdateMarketDto } from "../dtos/market/update-market.dto";
import { MarketFiltersDto } from "../dtos/market/market-filters.dto";

export interface MarketRecord {
  id: string;
  symbol: string;
  name: string;
  category: string;
  base_currency: string;
  quote_currency: string;
  min_price_increment: string; // Decimal as string from database
  min_quantity_increment: string; // Decimal as string from database
  max_quantity: string | null; // Decimal as string from database
  is_active: boolean;
  is_24h: boolean;
  trading_start: string | null; // Time string
  trading_end: string | null; // Time string
  timezone: string;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class MarketDao extends KnexDao<MarketDao> {
  protected readonly tableName = "markets";

  /**
   * Insert a new market into the database
   */
  async createMarket(market: CreateMarketDto): Promise<string | null> {
    try {
      const [result] = await this.knex(this.tableName)
        .insert({
          symbol: market.symbol,
          name: market.name,
          category: market.category,
          base_currency: market.baseCurrency,
          quote_currency: market.quoteCurrency,
          min_price_increment: (market.minPriceIncrement || 0.01).toString(),
          min_quantity_increment: (
            market.minQuantityIncrement || 0.00000001
          ).toString(),
          max_quantity: market.maxQuantity?.toString() || null,
          is_active: market.isActive ?? true,
          is_24h: market.is24h ?? false,
          trading_start: market.tradingStart || null,
          trading_end: market.tradingEnd || null,
          timezone: market.timezone || "UTC",
          metadata: market.metadata || null,
        })
        .returning("id");

      return result?.id || null;
    } catch (error) {
      console.error("Error creating market:", error);
      return null;
    }
  }

  /**
   * Get a market by ID
   */
  async getMarketById(id: string): Promise<MarketRecord | null> {
    try {
      const [result] = await this.knex(this.tableName).where("id", id);
      return result || null;
    } catch (error) {
      console.error("Error fetching market by ID:", error);
      return null;
    }
  }

  /**
   * Get a market by symbol
   */
  async getMarketBySymbol(symbol: string): Promise<MarketRecord | null> {
    try {
      const [result] = await this.knex(this.tableName).where("symbol", symbol);
      return result || null;
    } catch (error) {
      console.error("Error fetching market by symbol:", error);
      return null;
    }
  }

  /**
   * Get all markets with optional filters
   */
  async getMarkets(filters?: MarketFiltersDto): Promise<MarketRecord[]> {
    try {
      let query = this.knex(this.tableName);

      if (filters?.category) {
        query = query.where("category", filters.category);
      }

      if (filters?.baseCurrency) {
        query = query.where("base_currency", filters.baseCurrency);
      }

      if (filters?.quoteCurrency) {
        query = query.where("quote_currency", filters.quoteCurrency);
      }

      if (filters?.isActive !== undefined) {
        query = query.where("is_active", filters.isActive);
      }

      if (filters?.is24h !== undefined) {
        query = query.where("is_24h", filters.is24h);
      }

      return await query.orderBy("symbol", "asc");
    } catch (error) {
      console.error("Error fetching markets:", error);
      return [];
    }
  }

  /**
   * Get markets by category
   */
  async getMarketsByCategory(category: string): Promise<MarketRecord[]> {
    try {
      return await this.knex(this.tableName)
        .where("category", category)
        .orderBy("symbol", "asc");
    } catch (error) {
      console.error("Error fetching markets by category:", error);
      return [];
    }
  }

  /**
   * Get all active markets
   */
  async getActiveMarkets(): Promise<MarketRecord[]> {
    try {
      return await this.knex(this.tableName)
        .where("is_active", true)
        .orderBy("symbol", "asc");
    } catch (error) {
      console.error("Error fetching active markets:", error);
      return [];
    }
  }

  /**
   * Update a market
   */
  async updateMarket(id: string, market: UpdateMarketDto): Promise<boolean> {
    try {
      const updateData: any = {};

      if (market.symbol !== undefined) updateData.symbol = market.symbol;
      if (market.name !== undefined) updateData.name = market.name;
      if (market.category !== undefined) updateData.category = market.category;
      if (market.baseCurrency !== undefined)
        updateData.base_currency = market.baseCurrency;
      if (market.quoteCurrency !== undefined)
        updateData.quote_currency = market.quoteCurrency;
      if (market.minPriceIncrement !== undefined)
        updateData.min_price_increment = market.minPriceIncrement.toString();
      if (market.minQuantityIncrement !== undefined)
        updateData.min_quantity_increment =
          market.minQuantityIncrement.toString();
      if (market.maxQuantity !== undefined)
        updateData.max_quantity = market.maxQuantity?.toString() || null;
      if (market.isActive !== undefined) updateData.is_active = market.isActive;
      if (market.is24h !== undefined) updateData.is_24h = market.is24h;
      if (market.tradingStart !== undefined)
        updateData.trading_start = market.tradingStart;
      if (market.tradingEnd !== undefined)
        updateData.trading_end = market.tradingEnd;
      if (market.timezone !== undefined) updateData.timezone = market.timezone;
      if (market.metadata !== undefined) updateData.metadata = market.metadata;

      updateData.updated_at = this.knex.fn.now();

      const updatedCount = await this.knex(this.tableName)
        .where("id", id)
        .update(updateData);

      return updatedCount > 0;
    } catch (error) {
      console.error("Error updating market:", error);
      return false;
    }
  }

  /**
   * Delete a market by ID
   */
  async deleteMarket(id: string): Promise<boolean> {
    try {
      const deletedCount = await this.knex(this.tableName)
        .where("id", id)
        .delete();
      return deletedCount > 0;
    } catch (error) {
      console.error("Error deleting market:", error);
      return false;
    }
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const results = await this.knex(this.tableName)
        .distinct("category")
        .pluck("category");
      return results;
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  }
}
