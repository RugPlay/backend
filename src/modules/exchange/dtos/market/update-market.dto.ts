import { ApiPropertyOptional } from "@nestjs/swagger";
import type { MarketCategory } from "../../types/market-category";

export class UpdateMarketDto {
  @ApiPropertyOptional({
    description: "Market symbol (e.g., BTCUSD)",
    example: "BTCUSD",
  })
  symbol?: string;

  @ApiPropertyOptional({
    description: "Market display name",
    example: "Bitcoin to USD",
  })
  name?: string;

  @ApiPropertyOptional({
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
  category?: MarketCategory;

  @ApiPropertyOptional({
    description: "Market subcategory",
    example: "spot",
  })
  subcategory?: string;

  @ApiPropertyOptional({
    description: "Base currency code",
    example: "BTC",
  })
  baseCurrency?: string;

  @ApiPropertyOptional({
    description: "Quote currency code",
    example: "USD",
  })
  quoteCurrency?: string;

  @ApiPropertyOptional({
    description: "Minimum price increment",
    example: 0.01,
  })
  minPriceIncrement?: number;

  @ApiPropertyOptional({
    description: "Minimum quantity increment",
    example: 0.001,
  })
  minQuantityIncrement?: number;

  @ApiPropertyOptional({
    description: "Maximum quantity allowed",
    example: 1000000,
  })
  maxQuantity?: number;

  @ApiPropertyOptional({
    description: "Whether the market is active",
    example: true,
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Whether the market trades 24/7",
    example: true,
  })
  is24h?: boolean;

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

  @ApiPropertyOptional({
    description: "Market timezone",
    example: "UTC",
  })
  timezone?: string;

  @ApiPropertyOptional({
    description: "Additional market metadata",
    example: { provider: "binance", fees: { maker: 0.001, taker: 0.001 } },
  })
  metadata?: Record<string, any>;
}
