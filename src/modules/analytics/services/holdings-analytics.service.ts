import { Injectable, Logger } from "@nestjs/common";
import { HoldingsAnalyticsDao } from "../daos/holdings-analytics.dao";
import { HoldingsProductionDto, HoldingsProductionQueryDto } from "../dtos/holdings/holdings-production.dto";
import { HoldingsGrowthDto } from "../dtos/holdings/holdings-growth.dto";
import { TimeBucketInterval } from "../dtos/shared/time-bucket.dto";

@Injectable()
export class HoldingsAnalyticsService {
  private readonly logger = new Logger(HoldingsAnalyticsService.name);

  constructor(private readonly holdingsAnalyticsDao: HoldingsAnalyticsDao) {}

  /**
   * Get holdings production rate data (created/removed over time)
   */
  async getHoldingsProductionData(
    query: HoldingsProductionQueryDto,
  ): Promise<HoldingsProductionDto[]> {
    try {
      return await this.holdingsAnalyticsDao.getHoldingsProductionData(query);
    } catch (error) {
      this.logger.error("Error getting holdings production data:", error);
      throw error;
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
      return await this.holdingsAnalyticsDao.getHoldingsGrowthData(
        interval,
        userId,
        assetId,
        startTime,
        endTime,
        limit,
      );
    } catch (error) {
      this.logger.error("Error getting holdings growth data:", error);
      throw error;
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
      return await this.holdingsAnalyticsDao.getTotalHoldingsCount(userId, assetId, atTime);
    } catch (error) {
      this.logger.error("Error getting total holdings count:", error);
      throw error;
    }
  }
}

