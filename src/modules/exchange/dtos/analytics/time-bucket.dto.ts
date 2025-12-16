import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Supported time bucket intervals for time-series queries
 */
export enum TimeBucketInterval {
  ONE_MINUTE = "1 minute",
  FIVE_MINUTES = "5 minutes",
  FIFTEEN_MINUTES = "15 minutes",
  THIRTY_MINUTES = "30 minutes",
  ONE_HOUR = "1 hour",
  FOUR_HOURS = "4 hours",
  ONE_DAY = "1 day",
  ONE_WEEK = "1 week",
  ONE_MONTH = "1 month",
}

/**
 * DTO for time-series query parameters
 */
export class TimeBucketQueryDto {
  @ApiProperty({
    description: "The market ID to query",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  marketId: string;

  @ApiProperty({
    description: "The time bucket interval",
    enum: TimeBucketInterval,
    example: TimeBucketInterval.FIVE_MINUTES,
  })
  interval: TimeBucketInterval;

  @ApiPropertyOptional({
    description: "Start time for the query range (ISO 8601 format)",
    example: "2025-01-01T00:00:00Z",
  })
  startTime?: Date;

  @ApiPropertyOptional({
    description: "End time for the query range (ISO 8601 format)",
    example: "2025-01-01T23:59:59Z",
  })
  endTime?: Date;

  @ApiPropertyOptional({
    description: "Maximum number of data points to return",
    example: 100,
    default: 100,
  })
  limit?: number;
}

