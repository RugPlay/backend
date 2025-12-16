import { ApiProperty } from "@nestjs/swagger";

/**
 * OHLC (Open, High, Low, Close) data point for candlestick charts
 */
export class OhlcDto {
  @ApiProperty({
    description: "The start time of the time bucket",
    example: "2025-01-01T00:00:00Z",
  })
  timestamp: Date;

  @ApiProperty({
    description: "The opening price for this time period",
    example: 50000.5,
  })
  open: number;

  @ApiProperty({
    description: "The highest price during this time period",
    example: 51000.0,
  })
  high: number;

  @ApiProperty({
    description: "The lowest price during this time period",
    example: 49500.0,
  })
  low: number;

  @ApiProperty({
    description: "The closing price for this time period",
    example: 50500.0,
  })
  close: number;

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

