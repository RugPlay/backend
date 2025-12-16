import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsInt, Min, IsBoolean } from "class-validator";

export class UpdateAssetDto {
  @ApiPropertyOptional({
    description: "Asset symbol",
    example: "BTC",
  })
  @IsString()
  @IsOptional()
  symbol?: string;

  @ApiPropertyOptional({
    description: "Asset name",
    example: "Bitcoin",
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: "Asset type",
    enum: ["currency", "crypto", "commodity", "stock", "other"],
    example: "crypto",
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: "Number of decimal places for precision",
    example: 8,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  decimals?: number;

  @ApiPropertyOptional({
    description: "Whether the asset is active",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

