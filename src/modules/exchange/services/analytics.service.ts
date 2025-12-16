import { Injectable, Logger } from "@nestjs/common";
import { AnalyticsDao } from "../daos/analytics.dao";
import { OhlcDto } from "../dtos/analytics/ohlc.dto";
import { VolumeDto } from "../dtos/analytics/volume.dto";
import { PriceChangeDto } from "../dtos/analytics/price-change.dto";
import { TimeBucketInterval, TimeBucketQueryDto } from "../dtos/analytics/time-bucket.dto";

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly analyticsDao: AnalyticsDao) {}

  /**
   * Get OHLC (candlestick) data for a market
   */
  async getOhlcData(query: TimeBucketQueryDto): Promise<OhlcDto[]> {
    try {
      return await this.analyticsDao.getOhlcData(
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
  async getVolumeData(query: TimeBucketQueryDto): Promise<VolumeDto[]> {
    try {
      return await this.analyticsDao.getVolumeData(
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
  async getPriceChangeData(query: TimeBucketQueryDto): Promise<PriceChangeDto[]> {
    try {
      return await this.analyticsDao.getPriceChangeData(
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
      return await this.analyticsDao.getLatestPrice(marketId);
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
      return await this.analyticsDao.get24HourStats(marketId);
    } catch (error) {
      this.logger.error(`Error getting 24-hour stats for market ${marketId}:`, error);
      throw error;
    }
  }
}

