import { Injectable, Logger } from "@nestjs/common";
import { MarketsAnalyticsDao } from "../daos/markets-analytics.dao";
import { OhlcDto } from "../dtos/markets/ohlc.dto";
import { VolumeDto } from "../dtos/markets/volume.dto";
import { PriceChangeDto } from "../dtos/markets/price-change.dto";
import { MarketTimeBucketQueryDto } from "../dtos/shared/time-bucket.dto";

@Injectable()
export class MarketsAnalyticsService {
  private readonly logger = new Logger(MarketsAnalyticsService.name);

  constructor(private readonly marketsAnalyticsDao: MarketsAnalyticsDao) {}

  /**
   * Get OHLC (candlestick) data for a market
   */
  async getOhlcData(query: MarketTimeBucketQueryDto): Promise<OhlcDto[]> {
    try {
      return await this.marketsAnalyticsDao.getOhlcData(
        query.marketId,
        query.interval,
        query.startTime,
        query.endTime,
        query.limit,
      );
    } catch (error) {
      this.logger.error(`Error getting OHLC data for market ${query.marketId}:`, error);
      throw error;
    }
  }

  /**
   * Get volume data for a market
   */
  async getVolumeData(query: MarketTimeBucketQueryDto): Promise<VolumeDto[]> {
    try {
      return await this.marketsAnalyticsDao.getVolumeData(
        query.marketId,
        query.interval,
        query.startTime,
        query.endTime,
        query.limit,
      );
    } catch (error) {
      this.logger.error(`Error getting volume data for market ${query.marketId}:`, error);
      throw error;
    }
  }

  /**
   * Get price change data for a market
   */
  async getPriceChangeData(query: MarketTimeBucketQueryDto): Promise<PriceChangeDto[]> {
    try {
      return await this.marketsAnalyticsDao.getPriceChangeData(
        query.marketId,
        query.interval,
        query.startTime,
        query.endTime,
        query.limit,
      );
    } catch (error) {
      this.logger.error(`Error getting price change data for market ${query.marketId}:`, error);
      throw error;
    }
  }

  /**
   * Get the latest price for a market
   */
  async getLatestPrice(marketId: string): Promise<number | null> {
    try {
      return await this.marketsAnalyticsDao.getLatestPrice(marketId);
    } catch (error) {
      this.logger.error(`Error getting latest price for market ${marketId}:`, error);
      throw error;
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
      return await this.marketsAnalyticsDao.get24HourStats(marketId);
    } catch (error) {
      this.logger.error(`Error getting 24-hour stats for market ${marketId}:`, error);
      throw error;
    }
  }
}

