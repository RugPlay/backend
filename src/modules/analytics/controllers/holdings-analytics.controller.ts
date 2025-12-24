import {
  Controller,
  Get,
  Query,
  HttpStatus,
  HttpException,
  ParseEnumPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { HoldingsAnalyticsService } from "../services/holdings-analytics.service";
import { HoldingsProductionDto, HoldingsProductionQueryDto } from "../dtos/holdings/holdings-production.dto";
import { HoldingsGrowthDto } from "../dtos/holdings/holdings-growth.dto";
import { TimeBucketInterval } from "../dtos/shared/time-bucket.dto";

@ApiTags("analytics")
@Controller("analytics/holdings")
export class HoldingsAnalyticsController {
  constructor(private readonly holdingsAnalyticsService: HoldingsAnalyticsService) {}

  @Get("production")
  @ApiOperation({
    summary: "Get holdings production rate data",
    description: "Returns time-bucketed data showing how many holdings have been created and removed over time",
  })
  @ApiQuery({
    name: "interval",
    enum: TimeBucketInterval,
    description: "Time bucket interval",
    example: TimeBucketInterval.ONE_HOUR,
  })
  @ApiQuery({
    name: "corporationId",
    required: false,
    description: "Filter by specific corporation ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "assetId",
    required: false,
    description: "Filter by specific asset ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
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
    description: "Holdings production data retrieved successfully",
    type: [HoldingsProductionDto],
  })
  @ApiResponse({
    status: 400,
    description: "Invalid query parameters",
  })
  async getHoldingsProductionData(
    @Query("interval", new ParseEnumPipe(TimeBucketInterval)) interval: TimeBucketInterval,
    @Query("corporationId") corporationId?: string,
    @Query("assetId") assetId?: string,
    @Query("startTime") startTime?: string,
    @Query("endTime") endTime?: string,
    @Query("limit") limit?: string,
  ): Promise<HoldingsProductionDto[]> {
    try {
      const query: HoldingsProductionQueryDto = {
        interval,
        corporationId,
        assetId,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      };

      return await this.holdingsAnalyticsService.getHoldingsProductionData(query);
    } catch (error) {
      throw new HttpException(
        "Failed to retrieve holdings production data",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("growth")
  @ApiOperation({
    summary: "Get holdings growth data",
    description: "Returns time-bucketed data showing quantity changes and growth rates over time",
  })
  @ApiQuery({
    name: "interval",
    enum: TimeBucketInterval,
    description: "Time bucket interval",
    example: TimeBucketInterval.ONE_HOUR,
  })
  @ApiQuery({
    name: "corporationId",
    required: false,
    description: "Filter by specific corporation ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "assetId",
    required: false,
    description: "Filter by specific asset ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
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
    description: "Holdings growth data retrieved successfully",
    type: [HoldingsGrowthDto],
  })
  @ApiResponse({
    status: 400,
    description: "Invalid query parameters",
  })
  async getHoldingsGrowthData(
    @Query("interval", new ParseEnumPipe(TimeBucketInterval)) interval: TimeBucketInterval,
    @Query("corporationId") corporationId?: string,
    @Query("assetId") assetId?: string,
    @Query("startTime") startTime?: string,
    @Query("endTime") endTime?: string,
    @Query("limit") limit?: string,
  ): Promise<HoldingsGrowthDto[]> {
    try {
      return await this.holdingsAnalyticsService.getHoldingsGrowthData(
        interval,
        corporationId,
        assetId,
        startTime ? new Date(startTime) : undefined,
        endTime ? new Date(endTime) : undefined,
        limit ? parseInt(limit, 10) : undefined,
      );
    } catch (error) {
      throw new HttpException(
        "Failed to retrieve holdings growth data",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("count")
  @ApiOperation({
    summary: "Get total holdings count",
    description: "Returns the total number of holdings at a specific point in time",
  })
  @ApiQuery({
    name: "corporationId",
    required: false,
    description: "Filter by specific corporation ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "assetId",
    required: false,
    description: "Filter by specific asset ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "atTime",
    required: false,
    description: "Point in time to query (ISO 8601 format). Defaults to now.",
    example: "2025-01-01T12:00:00Z",
  })
  @ApiResponse({
    status: 200,
    description: "Total holdings count retrieved successfully",
    schema: {
      type: "number",
      example: 1250,
    },
  })
  async getTotalHoldingsCount(
    @Query("corporationId") corporationId?: string,
    @Query("assetId") assetId?: string,
    @Query("atTime") atTime?: string,
  ): Promise<number> {
    try {
      return await this.holdingsAnalyticsService.getTotalHoldingsCount(
        corporationId,
        assetId,
        atTime ? new Date(atTime) : undefined,
      );
    } catch (error) {
      throw new HttpException(
        "Failed to retrieve total holdings count",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

