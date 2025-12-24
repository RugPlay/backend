import { ApiProperty } from "@nestjs/swagger";

export class OrderBookEntryDto {
  @ApiProperty({
    description: "The unique identifier of the market this entry belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  marketId: string;

  @ApiProperty({
    description: "The price level for this order book entry",
    example: 50000.5,
  })
  price: number;

  @ApiProperty({
    description: "The quantity available at this price level",
    example: 1.5,
  })
  quantity: number;

  @ApiProperty({
    description: "The timestamp when this entry was created",
    example: "2024-03-20T12:00:00Z",
  })
  timestamp: Date;

  @ApiProperty({
    description: "The unique identifier of the order",
    example: "ord_123e4567-e89b-12d3-a456-426614174000",
  })
  orderId: string;

  @ApiProperty({
    description:
      "The side of the order book (bid for buy orders, ask for sell orders)",
    enum: ["bid", "ask"],
    example: "bid",
  })
  side: "bid" | "ask";

  @ApiProperty({
    description: "The corporation ID that owns this order",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  corporationId: string;

  @ApiProperty({
    description: "The quote asset ID (for both BID and ASK orders)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  quoteAssetId: string;
}
