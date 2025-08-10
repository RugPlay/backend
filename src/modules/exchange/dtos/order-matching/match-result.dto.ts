import { ApiProperty } from "@nestjs/swagger";

export class MatchResultDto {
  @ApiProperty({
    description: "The unique identifier of the market where the match occurred",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  marketId: string;

  @ApiProperty({
    description:
      "The order ID of the taker (incoming order that initiated the match)",
    example: "ord_123e4567-e89b-12d3-a456-426614174000",
  })
  takerOrderId: string;

  @ApiProperty({
    description: "The order ID of the maker (existing order that was matched)",
    example: "ord_456e7890-e89b-12d3-a456-426614174001",
  })
  makerOrderId: string;

  @ApiProperty({
    description: "The side of the taker order (bid for buy, ask for sell)",
    example: "bid",
    enum: ["bid", "ask"],
  })
  takerSide: "bid" | "ask";

  @ApiProperty({
    description: "The quantity that was matched between the orders",
    example: 1.5,
  })
  matchedQuantity: number;

  @ApiProperty({
    description: "The price at which the match occurred",
    example: 50000.5,
  })
  matchedPrice: number;

  @ApiProperty({
    description: "The timestamp when the match occurred",
    example: "2024-03-20T12:00:00Z",
  })
  timestamp: Date;

  @ApiProperty({
    description: "The remaining quantity for the taker order after the match",
    example: 0.5,
  })
  takerRemainingQuantity: number;

  @ApiProperty({
    description: "The remaining quantity for the maker order after the match",
    example: 0.0,
  })
  makerRemainingQuantity: number;
}
