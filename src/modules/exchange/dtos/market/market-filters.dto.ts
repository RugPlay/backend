import { ApiPropertyOptional } from "@nestjs/swagger";
import type { MarketCategory } from "../../types/market-category";

export class MarketFiltersDto {
  @ApiPropertyOptional({
    description: "Filter by market category",
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
    description: "Filter by market subcategory",
    example: "spot",
  })
  subcategory?: string;

  @ApiPropertyOptional({
    description: "Filter by base currency",
    example: "BTC",
  })
  baseCurrency?: string;

  @ApiPropertyOptional({
    description: "Filter by quote currency",
    example: "USD",
  })
  quoteCurrency?: string;

  @ApiPropertyOptional({
    description: "Filter by active status",
    example: true,
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Filter by 24h trading status",
    example: true,
  })
  is24h?: boolean;
}
