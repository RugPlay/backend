import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
  HttpException,
  ParseEnumPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { MarketsAnalyticsService } from "../services/markets-analytics.service";
import { OhlcDto } from "../dtos/markets/ohlc.dto";
import { VolumeDto } from "../dtos/markets/volume.dto";
import { PriceChangeDto } from "../dtos/markets/price-change.dto";
import { TimeBucketInterval } from "../dtos/shared/time-bucket.dto";

@ApiTags("analytics")
@Controller("analytics/markets")
export class MarketsAnalyticsController {
  constructor(private readonly marketsAnalyticsService: MarketsAnalyticsService) {}

  @Get(":marketId/ohlc")
  @ApiOperation({
    summary: "Get OHLC (Open, High, Low, Close) candlestick data for a market",
    description: "Returns time-bucketed OHLC data for candlestick charts. Supports various time intervals (1min, 5min, 1hr, etc.)",
  })
  @ApiParam({
    name: "marketId",
    description: "The market ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "interval",
    enum: TimeBucketInterval,
    description: "Time bucket interval",
    example: TimeBucketInterval.FIVE_MINUTES,
  })
  @ApiQuery({
    name: "startTime",
    required: false,
    description: "Start time for the query range (ISO 8601 format)",
    example: "2025-01-01T00:00:00Z",
  })
  @ApiQuery({
    name: "endTime",
    required: false,
    description: "End time for the query range (ISO 8601 format)",
    example: "2025-01-01T23:59:59Z",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Maximum number of data points to return",
    example: 100,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: "OHLC data retrieved successfully",
    type: [OhlcDto],
  })
  @ApiResponse({
    status: 400,
    description: "Invalid query parameters",
  })
  async getOhlcData(
    @Param("marketId") marketId: string,
    @Query("interval", new ParseEnumPipe(TimeBucketInterval)) interval: TimeBucketInterval,
    @Query("startTime") startTime?: string,
    @Query("endTime") endTime?: string,
    @Query("limit") limit?: string,
  ): Promise<OhlcDto[]> {
    try {
      return await this.marketsAnalyticsService.getOhlcData({
        marketId,
        interval,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
    } catch (error) {
      throw new HttpException(
        "Failed to retrieve OHLC data",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(":marketId/volume")
  @ApiOperation({
    summary: "Get volume data for a market",
    description: "Returns time-bucketed volume data showing trading volume over time",
  })
  @ApiParam({
    name: "marketId",
    description: "The market ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "interval",
    enum: TimeBucketInterval,
    description: "Time bucket interval",
    example: TimeBucketInterval.FIVE_MINUTES,
  })
  @ApiQuery({
    name: "startTime",
    required: false,
    description: "Start time for the query range (ISO 8601 format)",
    example: "2025-01-01T00:00:00Z",
  })
  @ApiQuery({
    name: "endTime",
    required: false,
    description: "End time for the query range (ISO 8601 format)",
    example: "2025-01-01T23:59:59Z",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Maximum number of data points to return",
    example: 100,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: "Volume data retrieved successfully",
    type: [VolumeDto],
  })
  @ApiResponse({
    status: 400,
    description: "Invalid query parameters",
  })
  async getVolumeData(
    @Param("marketId") marketId: string,
    @Query("interval", new ParseEnumPipe(TimeBucketInterval)) interval: TimeBucketInterval,
    @Query("startTime") startTime?: string,
    @Query("endTime") endTime?: string,
    @Query("limit") limit?: string,
  ): Promise<VolumeDto[]> {
    try {
      return await this.marketsAnalyticsService.getVolumeData({
        marketId,
        interval,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
    } catch (error) {
      throw new HttpException(
        "Failed to retrieve volume data",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(":marketId/price-change")
  @ApiOperation({
    summary: "Get price change data for a market",
    description: "Returns time-bucketed price change data showing price movements over time",
  })
  @ApiParam({
    name: "marketId",
    description: "The market ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "interval",
    enum: TimeBucketInterval,
    description: "Time bucket interval",
    example: TimeBucketInterval.FIVE_MINUTES,
  })
  @ApiQuery({
    name: "startTime",
    required: false,
    description: "Start time for the query range (ISO 8601 format)",
    example: "2025-01-01T00:00:00Z",
  })
  @ApiQuery({
    name: "endTime",
    required: false,
    description: "End time for the query range (ISO 8601 format)",
    example: "2025-01-01T23:59:59Z",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Maximum number of data points to return",
    example: 100,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: "Price change data retrieved successfully",
    type: [PriceChangeDto],
  })
  @ApiResponse({
    status: 400,
    description: "Invalid query parameters",
  })
  async getPriceChangeData(
    @Param("marketId") marketId: string,
    @Query("interval", new ParseEnumPipe(TimeBucketInterval)) interval: TimeBucketInterval,
    @Query("startTime") startTime?: string,
    @Query("endTime") endTime?: string,
    @Query("limit") limit?: string,
  ): Promise<PriceChangeDto[]> {
    try {
      return await this.marketsAnalyticsService.getPriceChangeData({
        marketId,
        interval,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
    } catch (error) {
      throw new HttpException(
        "Failed to retrieve price change data",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(":marketId/latest-price")
  @ApiOperation({
    summary: "Get the latest price for a market",
    description: "Returns the most recent trade price for a market",
  })
  @ApiParam({
    name: "marketId",
    description: "The market ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Latest price retrieved successfully",
    schema: {
      type: "number",
      example: 50000.5,
    },
  })
  async getLatestPrice(@Param("marketId") marketId: string): Promise<number | null> {
    try {
      return await this.marketsAnalyticsService.getLatestPrice(marketId);
    } catch (error) {
      throw new HttpException(
        "Failed to retrieve latest price",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(":marketId/24h-stats")
  @ApiOperation({
    summary: "Get 24-hour statistics for a market",
    description: "Returns OHLC, volume, and price change statistics for the last 24 hours",
  })
  @ApiParam({
    name: "marketId",
    description: "The market ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "24-hour statistics retrieved successfully",
    schema: {
      type: "object",
      properties: {
        open: { type: "number", example: 50000.5 },
        high: { type: "number", example: 51000.0 },
        low: { type: "number", example: 49500.0 },
        close: { type: "number", example: 50500.0 },
        volume: { type: "number", example: 1250.5 },
        tradeCount: { type: "number", example: 42 },
        change: { type: "number", example: 500.0 },
        changePercent: { type: "number", example: 1.0 },
      },
    },
  })
  async get24HourStats(@Param("marketId") marketId: string): Promise<{
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
      return await this.marketsAnalyticsService.get24HourStats(marketId);
    } catch (error) {
      throw new HttpException(
        "Failed to retrieve 24-hour statistics",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

