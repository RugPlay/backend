import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean } from "class-validator";

export class AssetFiltersDto {
  @ApiPropertyOptional({
    description: "Filter by asset type",
    example: "crypto",
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: "Filter by active status",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Filter by symbol",
    example: "BTC",
  })
  @IsString()
  @IsOptional()
  symbol?: string;
}

