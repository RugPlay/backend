import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsBoolean } from "class-validator";

export class CreateAssetDto {
  @ApiProperty({
    description: "Asset symbol (e.g., USD, EUR, BTC, ETH)",
    example: "BTC",
  })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({
    description: "Asset name",
    example: "Bitcoin",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: "Asset type",
    enum: ["currency", "crypto", "commodity", "stock", "other"],
    example: "crypto",
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: "Number of decimal places for precision",
    example: 8,
    default: 8,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  decimals?: number;

  @ApiProperty({
    description: "Whether the asset is active",
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

