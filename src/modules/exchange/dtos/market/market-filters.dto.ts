import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsUUID, IsOptional } from "class-validator";
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
    description: "Filter by base asset symbol",
    example: "BTC",
  })
  baseAsset?: string;

  @ApiPropertyOptional({
    description: "Filter by quote asset symbol",
    example: "USD",
  })
  quoteAsset?: string;

  @ApiPropertyOptional({
    description: "Filter by base asset ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID(4, { message: "Base asset ID must be a valid UUID", each: true })
  @IsOptional()
  baseAssetId?: string;

  @ApiPropertyOptional({
    description: "Filter by quote asset ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID(4, { message: "Quote asset ID must be a valid UUID", each: true })
  @IsOptional()
  quoteAssetId?: string;

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
