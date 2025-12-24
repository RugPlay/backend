import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TimeBucketInterval, TimeBucketQueryDto } from "../shared/time-bucket.dto";

/**
 * Holdings production rate data point
 */
export class HoldingsProductionDto {
  @ApiProperty({
    description: "The start time of the time bucket",
    example: "2025-01-01T00:00:00Z",
  })
  timestamp: Date;

  @ApiProperty({
    description: "Number of holdings created in this time period",
    example: 15,
  })
  created: number;

  @ApiProperty({
    description: "Number of holdings removed (deleted or zeroed) in this time period",
    example: 3,
  })
  removed: number;

  @ApiProperty({
    description: "Net change in holdings (created - removed)",
    example: 12,
  })
  netChange: number;

  @ApiProperty({
    description: "Total number of holdings at the end of this time period",
    example: 1250,
  })
  totalHoldings: number;
}

/**
 * DTO for holdings production query parameters
 */
export class HoldingsProductionQueryDto extends TimeBucketQueryDto {
  @ApiPropertyOptional({
    description: "Filter by specific corporation ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  corporationId?: string;

  @ApiPropertyOptional({
    description: "Filter by specific asset ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  assetId?: string;
}

