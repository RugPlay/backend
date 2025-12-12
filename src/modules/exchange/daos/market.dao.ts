import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { CreateMarketDto } from "../dtos/market/create-market.dto";
import { UpdateMarketDto } from "../dtos/market/update-market.dto";
import { MarketFiltersDto } from "../dtos/market/market-filters.dto";
import { MarketDto } from "../dtos/market/market.dto";
import type { MarketCategory } from "../types/market-category";
import { sql } from "kysely";

@Injectable()
export class MarketDao extends KyselyDao<MarketDao> {

  /**
   * Insert a new market into the database
   */
  async createMarket(market: CreateMarketDto): Promise<string | null> {
    try {
      const result = await this.kysely
        .insertInto('markets')
        .values({
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
          metadata: market.metadata ? JSON.stringify(market.metadata) : null,
        } as any)
        .returning('id')
        .executeTakeFirst();

      return result?.id || null;
    } catch (error) {
      console.error("Error creating market:", error);
      return null;
    }
  }

  /**
   * Get a market by ID
   */
  async getMarketById(id: string): Promise<MarketDto | null> {
    try {
      const result = await this.kysely
        .selectFrom('markets')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return result ? this.mapRecordToDto(result) : null;
    } catch (error) {
      console.error("Error fetching market by ID:", error);
      return null;
    }
  }

  /**
   * Get a market by symbol
   */
  async getMarketBySymbol(symbol: string): Promise<MarketDto | null> {
    try {
      const result = await this.kysely
        .selectFrom('markets')
        .selectAll()
        .where('symbol', '=', symbol)
        .executeTakeFirst();
      return result ? this.mapRecordToDto(result) : null;
    } catch (error) {
      console.error("Error fetching market by symbol:", error);
      return null;
    }
  }

  /**
   * Get all markets with optional filters
   */
  async getMarkets(filters?: MarketFiltersDto): Promise<MarketDto[]> {
    try {
      let query = this.kysely
        .selectFrom('markets')
        .selectAll();

      if (filters?.category) {
        query = query.where('category', '=', filters.category);
      }

      if (filters?.baseCurrency) {
        query = query.where('base_currency', '=', filters.baseCurrency);
      }

      if (filters?.quoteCurrency) {
        query = query.where('quote_currency', '=', filters.quoteCurrency);
      }

      if (filters?.isActive !== undefined) {
        query = query.where('is_active', '=', filters.isActive);
      }

      if (filters?.is24h !== undefined) {
        query = query.where('is_24h', '=', filters.is24h);
      }

      const results = await query.orderBy('symbol', 'asc').execute();
      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching markets:", error);
      return [];
    }
  }

  /**
   * Get markets by category
   */
  async getMarketsByCategory(category: string): Promise<MarketDto[]> {
    try {
      const results = await this.kysely
        .selectFrom('markets')
        .selectAll()
        .where('category', '=', category)
        .orderBy('symbol', 'asc')
        .execute();
      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching markets by category:", error);
      return [];
    }
  }

  /**
   * Get all active markets
   */
  async getActiveMarkets(): Promise<MarketDto[]> {
    try {
      const results = await this.kysely
        .selectFrom('markets')
        .selectAll()
        .where('is_active', '=', true)
        .orderBy('symbol', 'asc')
        .execute();
      return results.map((record) => this.mapRecordToDto(record));
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
      if (market.metadata !== undefined) updateData.metadata = market.metadata ? JSON.stringify(market.metadata) : null;

      updateData.updated_at = sql`CURRENT_TIMESTAMP`;

      const result = await this.kysely
        .updateTable('markets')
        .set(updateData)
        .where('id', '=', id)
        .executeTakeFirst();

      return result.numUpdatedRows > 0;
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
      const result = await this.kysely
        .deleteFrom('markets')
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numDeletedRows > 0;
    } catch (error) {
      console.error("Error deleting market:", error);
      return false;
    }
  }

  /**
   * Delete all markets (for testing)
   */
  async deleteAllMarkets(): Promise<boolean> {
    try {
      await this.kysely
        .deleteFrom('markets')
        .execute();
      return true;
    } catch (error) {
      console.error("Error deleting all markets:", error);
      return false;
    }
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const results = await this.kysely
        .selectFrom('markets')
        .select('category')
        .distinct()
        .execute();
      return results.map(row => row.category);
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  }

  /**
   * Map database record to MarketDto
   */
  private mapRecordToDto(record: any): MarketDto {
    const dto = new MarketDto();
    dto.id = record.id;
    dto.symbol = record.symbol;
    dto.name = record.name;
    dto.category = record.category as MarketCategory;
    dto.baseCurrency = record.base_currency;
    dto.quoteCurrency = record.quote_currency;
    dto.minPriceIncrement = parseFloat(record.min_price_increment);
    dto.minQuantityIncrement = parseFloat(record.min_quantity_increment);
    dto.maxQuantity = record.max_quantity
      ? parseFloat(record.max_quantity)
      : undefined;
    dto.isActive = record.is_active;
    dto.is24h = record.is_24h;
    dto.tradingStart = record.trading_start || undefined;
    dto.tradingEnd = record.trading_end || undefined;
    dto.timezone = record.timezone;
    dto.metadata = record.metadata || undefined;
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    return dto;
  }
}
