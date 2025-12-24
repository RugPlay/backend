import { OmitType, PickType } from "@nestjs/mapped-types";
import { MarketDto } from "./market.dto";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class CreateMarketDto extends OmitType(MarketDto, [
  "id",
  "createdAt",
  "updatedAt",
  "baseAssetId",
  "quoteAssetId",
] as const) {
  @ApiPropertyOptional({
    description: "Base asset ID (optional - will be resolved from baseAsset symbol if not provided)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  baseAssetId?: string;

  @ApiPropertyOptional({
    description: "Quote asset ID (optional - will be resolved from quoteAsset symbol if not provided)",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  quoteAssetId?: string;
}
