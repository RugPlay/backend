import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { MarketCategory } from "../../types/market-category";

export class MarketDto {
  @ApiProperty({
    description: "The unique identifier of the market",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Market symbol (e.g., BTCUSD)",
    example: "BTCUSD",
  })
  symbol: string;

  @ApiProperty({
    description: "Market display name",
    example: "Bitcoin to USD",
  })
  name: string;

  @ApiProperty({
    description: "Market category",
    enum: [
      "futures",
      "commodities",
      "forex",
      "crypto",
      "stocks",
      "indices",
      "bonds",
    ],
    example: "crypto",
  })
  category: MarketCategory;

  @ApiPropertyOptional({
    description: "Market subcategory",
    example: "spot",
  })
  subcategory?: string;

  @ApiProperty({
    description: "Base asset symbol",
    example: "BTC",
  })
  baseAsset: string;

  @ApiProperty({
    description: "Quote asset symbol",
    example: "USD",
  })
  quoteAsset: string;

  @ApiProperty({
    description: "Base asset ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  baseAssetId: string;

  @ApiProperty({
    description: "Quote asset ID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  quoteAssetId: string;

  @ApiProperty({
    description: "Minimum price increment",
    example: 0.01,
  })
  minPriceIncrement: number;

  @ApiProperty({
    description: "Minimum quantity increment",
    example: 0.001,
  })
  minQuantityIncrement: number;

  @ApiPropertyOptional({
    description: "Maximum quantity allowed",
    example: 1000000,
  })
  maxQuantity?: number;

  @ApiProperty({
    description: "Whether the market is active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Whether the market trades 24/7",
    example: true,
  })
  is24h: boolean;

  @ApiPropertyOptional({
    description: "Trading start time (HH:mm:ss format)",
    example: "09:00:00",
  })
  tradingStart?: string;

  @ApiPropertyOptional({
    description: "Trading end time (HH:mm:ss format)",
    example: "17:00:00",
  })
  tradingEnd?: string;

  @ApiProperty({
    description: "Market timezone",
    example: "UTC",
  })
  timezone: string;

  @ApiPropertyOptional({
    description: "Additional market metadata",
    example: { provider: "binance", fees: { maker: 0.001, taker: 0.001 } },
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: "The timestamp when the market was created",
    example: "2024-03-20T12:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "The timestamp when the market was last updated",
    example: "2024-03-20T12:00:00Z",
  })
  updatedAt: Date;
}
