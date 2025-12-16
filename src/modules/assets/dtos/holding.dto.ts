import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class HoldingDto {
  @ApiProperty({
    description: "The unique identifier of the holding",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "The user ID that owns this holding",
    example: "user_123e4567-e89b-12d3-a456-426614174000",
  })
  userId: string;

  @ApiProperty({
    description: "The asset ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  assetId: string;

  @ApiProperty({
    description: "The asset symbol for display",
    example: "BTC",
    required: false,
  })
  assetSymbol?: string;

  @ApiProperty({
    description: "The asset name for display",
    example: "Bitcoin",
    required: false,
  })
  assetName?: string;

  @ApiProperty({
    description: "The quantity of assets held",
    example: 1.5,
  })
  quantity: number;

  @ApiPropertyOptional({
    description: "Average cost basis per unit (average price paid)",
    example: 50000.0,
  })
  averageCostBasis?: number;

  @ApiPropertyOptional({
    description: "Total cost paid for all holdings (quantity * average_cost_basis)",
    example: 75000.0,
  })
  totalCost?: number;

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

