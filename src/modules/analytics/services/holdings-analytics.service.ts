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
    corporationId?: string,
    assetId?: string,
    startTime?: Date,
    endTime?: Date,
    limit?: number,
  ): Promise<HoldingsGrowthDto[]> {
    try {
      return await this.holdingsAnalyticsDao.getHoldingsGrowthData(
        interval,
        corporationId,
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
    corporationId?: string,
    assetId?: string,
    atTime?: Date,
  ): Promise<number> {
    try {
      return await this.holdingsAnalyticsDao.getTotalHoldingsCount(corporationId, assetId, atTime);
    } catch (error) {
      this.logger.error("Error getting total holdings count:", error);
      throw error;
    }
  }
}

