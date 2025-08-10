import { ApiProperty } from "@nestjs/swagger";

export class TradeExecutionDto {
  @ApiProperty({
    description: "The unique identifier of the trade execution",
    example: "trade_123e4567-e89b-12d3-a456-426614174000",
  })
  tradeId: string;

  @ApiProperty({
    description: "The unique identifier of the market where the trade occurred",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  marketId: string;

  @ApiProperty({
    description:
      "The order ID of the taker (incoming order that triggered the match)",
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
    description: "The quantity that was traded",
    example: 1.5,
  })
  quantity: number;

  @ApiProperty({
    description: "The price at which the trade was executed",
    example: 50000.5,
  })
  price: number;

  @ApiProperty({
    description: "The timestamp when the trade was executed",
    example: "2024-03-20T12:00:00Z",
  })
  timestamp: Date;

  @ApiProperty({
    description: "The user ID of the taker (optional)",
    required: false,
    example: "user_123e4567-e89b-12d3-a456-426614174000",
  })
  takerUserId?: string;

  @ApiProperty({
    description: "The user ID of the maker (optional)",
    required: false,
    example: "user_456e7890-e89b-12d3-a456-426614174001",
  })
  makerUserId?: string;
}
