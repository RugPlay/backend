import { ApiProperty } from "@nestjs/swagger";

export class OrderDto {
  @ApiProperty({
    description: "The unique identifier of the order",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "The unique identifier of the market this order belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  marketId: string;

  @ApiProperty({
    description:
      "The side of the order (bid for buy orders, ask for sell orders)",
    enum: ["bid", "ask"],
    example: "bid",
  })
  side: "bid" | "ask";

  @ApiProperty({
    description: "The price for this order",
    example: 50000.5,
  })
  price: number;

  @ApiProperty({
    description: "The quantity for this order",
    example: 1.5,
  })
  quantity: number;

  @ApiProperty({
    description: "The timestamp when the order was created",
    example: "2024-03-20T12:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "The timestamp when the order was last updated",
    example: "2024-03-20T12:00:00Z",
  })
  updatedAt: Date;

  @ApiProperty({
    description: "The unique identifier of the portfolio that owns this order",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  portfolioId: string;
}
