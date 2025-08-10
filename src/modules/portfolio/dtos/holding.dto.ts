import { ApiProperty } from "@nestjs/swagger";

export class HoldingDto {
  @ApiProperty({
    description: "The unique identifier of the holding",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "The portfolio ID that owns this holding",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  portfolioId: string;

  @ApiProperty({
    description: "The market ID of the asset",
    example: "market_123e4567-e89b-12d3-a456-426614174000",
  })
  marketId: string;

  @ApiProperty({
    description: "The market symbol for display",
    example: "BTCUSD",
    required: false,
  })
  marketSymbol?: string;

  @ApiProperty({
    description: "The market name for display",
    example: "Bitcoin to USD",
    required: false,
  })
  marketName?: string;

  @ApiProperty({
    description: "The quantity of assets held",
    example: 1.5,
  })
  quantity: number;

  @ApiProperty({
    description: "The timestamp when the holding was created",
    example: "2024-03-20T12:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "The timestamp when the holding was last updated",
    example: "2024-03-20T12:00:00Z",
  })
  updatedAt: Date;
}
