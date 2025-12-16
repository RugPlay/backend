import { ApiProperty } from "@nestjs/swagger";

/**
 * Volume data point for a specific time bucket
 */
export class VolumeDto {
  @ApiProperty({
    description: "The start time of the time bucket",
    example: "2025-01-01T00:00:00Z",
  })
  timestamp: Date;

  @ApiProperty({
    description: "The total volume (quantity) traded during this time period",
    example: 1250.5,
  })
  volume: number;

  @ApiProperty({
    description: "The number of trades in this time period",
    example: 42,
  })
  tradeCount: number;
}

