import { Injectable, Logger } from "@nestjs/common";
import { MarketDao } from "../daos/market.dao";
import { CreateMarketDto } from "../dtos/market/create-market.dto";
import { UpdateMarketDto } from "../dtos/market/update-market.dto";
import { MarketFiltersDto } from "../dtos/market/market-filters.dto";
import { MarketDto } from "../dtos/market/market.dto";
import type { MarketCategory } from "../types/market-category";

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(private readonly marketDao: MarketDao) {}

  /**
   * Create a new market
   */
  async createMarket(market: CreateMarketDto): Promise<MarketDto | null> {
    try {
      // Validate market symbol format
      if (!this.isValidMarketSymbol(market.symbol)) {
        this.logger.error(`Invalid market symbol format: ${market.symbol}`);
        return null;
      }

      // Check if market symbol already exists
      const existingMarket = await this.marketDao.getMarketBySymbol(
        market.symbol,
      );
      if (existingMarket) {
        this.logger.error(`Market with symbol ${market.symbol} already exists`);
        return null;
      }

      // Validate trading hours if provided
      if (market.tradingStart && market.tradingEnd) {
        if (!this.isValidTradingHours(market.tradingStart, market.tradingEnd)) {
          this.logger.error(
            `Invalid trading hours: ${market.tradingStart} - ${market.tradingEnd}`,
          );
          return null;
        }
      }

      // Create market in database
      const marketId = await this.marketDao.createMarket(market);
      if (!marketId) {
        this.logger.error("Failed to create market in database");
        return null;
      }

      // Retrieve and return the created market
      const createdMarket = await this.marketDao.getMarketById(marketId);
      if (!createdMarket) {
        this.logger.error("Failed to retrieve created market");
        return null;
      }

      this.logger.log(`Created market: ${market.symbol} (${market.name})`);
      return this.mapMarketRecordToMarket(createdMarket);
    } catch (error) {
      this.logger.error("Error creating market:", error);
      return null;
    }
  }

  /**
   * Get a market by ID
   */
  async getMarketById(id: string): Promise<MarketDto | null> {
    try {
      const marketRecord = await this.marketDao.getMarketById(id);
      if (!marketRecord) {
        return null;
      }

      return this.mapMarketRecordToMarket(marketRecord);
    } catch (error) {
      this.logger.error(`Error fetching market by ID ${id}:`, error);
      return null;
    }
  }

  /**
   * Get a market by symbol
   */
  async getMarketBySymbol(symbol: string): Promise<MarketDto | null> {
    try {
      const marketRecord = await this.marketDao.getMarketBySymbol(symbol);
      if (!marketRecord) {
        return null;
      }

      return this.mapMarketRecordToMarket(marketRecord);
    } catch (error) {
      this.logger.error(`Error fetching market by symbol ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get all markets with optional filters
   */
  async getMarkets(filters?: MarketFiltersDto): Promise<MarketDto[]> {
    try {
      const marketRecords = await this.marketDao.getMarkets(filters);
      return marketRecords.map((record) =>
        this.mapMarketRecordToMarket(record),
      );
    } catch (error) {
      this.logger.error("Error fetching markets:", error);
      return [];
    }
  }

  /**
   * Get markets by category
   */
  async getMarketsByCategory(category: MarketCategory): Promise<MarketDto[]> {
    try {
      const marketRecords = await this.marketDao.getMarketsByCategory(category);
      return marketRecords.map((record) =>
        this.mapMarketRecordToMarket(record),
      );
    } catch (error) {
      this.logger.error(
        `Error fetching markets by category ${category}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get all active markets
   */
  async getActiveMarkets(): Promise<MarketDto[]> {
    try {
      const marketRecords = await this.marketDao.getActiveMarkets();
      return marketRecords.map((record) =>
        this.mapMarketRecordToMarket(record),
      );
    } catch (error) {
      this.logger.error("Error fetching active markets:", error);
      return [];
    }
  }

  /**
   * Update a market
   */
  async updateMarket(
    id: string,
    market: UpdateMarketDto,
  ): Promise<MarketDto | null> {
    try {
      // Validate market symbol format if updating
      if (market.symbol && !this.isValidMarketSymbol(market.symbol)) {
        this.logger.error(`Invalid market symbol format: ${market.symbol}`);
        return null;
      }

      // Check if new symbol conflicts with existing market
      if (market.symbol) {
        const existingMarket = await this.marketDao.getMarketBySymbol(
          market.symbol,
        );
        if (existingMarket && existingMarket.id !== id) {
          this.logger.error(
            `Market with symbol ${market.symbol} already exists`,
          );
          return null;
        }
      }

      // Validate trading hours if provided
      if (market.tradingStart && market.tradingEnd) {
        if (!this.isValidTradingHours(market.tradingStart, market.tradingEnd)) {
          this.logger.error(
            `Invalid trading hours: ${market.tradingStart} - ${market.tradingEnd}`,
          );
          return null;
        }
      }

      // Update market in database
      const updated = await this.marketDao.updateMarket(id, market);
      if (!updated) {
        this.logger.error(`Failed to update market ${id}`);
        return null;
      }

      // Retrieve and return the updated market
      const updatedMarket = await this.marketDao.getMarketById(id);
      if (!updatedMarket) {
        this.logger.error("Failed to retrieve updated market");
        return null;
      }

      this.logger.log(`Updated market: ${updatedMarket.symbol}`);
      return this.mapMarketRecordToMarket(updatedMarket);
    } catch (error) {
      this.logger.error(`Error updating market ${id}:`, error);
      return null;
    }
  }

  /**
   * Delete a market
   */
  async deleteMarket(id: string): Promise<boolean> {
    try {
      const deleted = await this.marketDao.deleteMarket(id);
      if (deleted) {
        this.logger.log(`Deleted market: ${id}`);
      } else {
        this.logger.warn(`Market ${id} not found for deletion`);
      }
      return deleted;
    } catch (error) {
      this.logger.error(`Error deleting market ${id}:`, error);
      return false;
    }
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<MarketCategory[]> {
    try {
      const categories = await this.marketDao.getCategories();
      return categories as MarketCategory[];
    } catch (error) {
      this.logger.error("Error fetching categories:", error);
      return [];
    }
  }

  /**
   * Validate market symbol format
   */
  private isValidMarketSymbol(symbol: string): boolean {
    // Basic validation: symbol should contain a separator (e.g., "-", "/", "_")
    // and be alphanumeric with common separators
    const symbolRegex = /^[A-Z0-9]+[-/_][A-Z0-9]+$/;
    return (
      symbolRegex.test(symbol) && symbol.length >= 3 && symbol.length <= 20
    );
  }

  /**
   * Validate trading hours format
   */
  private isValidTradingHours(start: string, end: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    return timeRegex.test(start) && timeRegex.test(end);
  }

  /**
   * Map database record to Market interface
   */
  private mapMarketRecordToMarket(record: any): MarketDto {
    return {
      id: record.id,
      symbol: record.symbol,
      name: record.name,
      category: record.category as MarketCategory,
      subcategory: record.subcategory || undefined,
      baseCurrency: record.base_currency,
      quoteCurrency: record.quote_currency,
      minPriceIncrement: parseFloat(record.min_price_increment),
      minQuantityIncrement: parseFloat(record.min_quantity_increment),
      maxQuantity: record.max_quantity
        ? parseFloat(record.max_quantity)
        : undefined,
      isActive: record.is_active,
      is24h: record.is_24h,
      tradingStart: record.trading_start || undefined,
      tradingEnd: record.trading_end || undefined,
      timezone: record.timezone,
      metadata: record.metadata || undefined,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}
