import { ApiProperty } from "@nestjs/swagger";

export class AssetDto {
  @ApiProperty({
    description: "The unique identifier of the asset",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Asset symbol",
    example: "BTC",
  })
  symbol: string;

  @ApiProperty({
    description: "Asset name",
    example: "Bitcoin",
  })
  name: string;

  @ApiProperty({
    description: "Asset type",
    example: "crypto",
  })
  type: string;

  @ApiProperty({
    description: "Number of decimal places",
    example: 8,
  })
  decimals: number;

  @ApiProperty({
    description: "Whether the asset is active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "The timestamp when the asset was created",
    example: "2024-03-20T12:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "The timestamp when the asset was last updated",
    example: "2024-03-20T12:00:00Z",
  })
  updatedAt: Date;
}

