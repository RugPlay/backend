import { ApiProperty } from "@nestjs/swagger";

/**
 * Price change data point showing price movement over time
 */
export class PriceChangeDto {
  @ApiProperty({
    description: "The start time of the time bucket",
    example: "2025-01-01T00:00:00Z",
  })
  timestamp: Date;

  @ApiProperty({
    description: "The price at the start of this time period",
    example: 50000.5,
  })
  price: number;

  @ApiProperty({
    description: "The price change from the previous period",
    example: 500.0,
  })
  change: number;

  @ApiProperty({
    description: "The percentage change from the previous period",
    example: 1.0,
  })
  changePercent: number;
}

