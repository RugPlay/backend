import { ApiProperty } from "@nestjs/swagger";
import { OrderBookEntryDto } from "./order-book-entry.dto";

export class OrderBookDto {
  @ApiProperty({
    description:
      "The unique identifier of the market this order book belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  marketId: string;

  @ApiProperty({
    description: "Array of bid entries (buy orders) sorted by price descending",
    type: [OrderBookEntryDto],
    example: [
      {
        marketId: "123e4567-e89b-12d3-a456-426614174000",
        price: 50000.5,
        quantity: 1.5,
        timestamp: "2024-03-20T12:00:00Z",
        orderId: "ord_123e4567-e89b-12d3-a456-426614174000",
        side: "bid",
      },
    ],
  })
  bids: OrderBookEntryDto[];

  @ApiProperty({
    description: "Array of ask entries (sell orders) sorted by price ascending",
    type: [OrderBookEntryDto],
    example: [
      {
        marketId: "123e4567-e89b-12d3-a456-426614174000",
        price: 50001.0,
        quantity: 2.0,
        timestamp: "2024-03-20T12:00:00Z",
        orderId: "ord_456e7890-e89b-12d3-a456-426614174001",
        side: "ask",
      },
    ],
  })
  asks: OrderBookEntryDto[];

  @ApiProperty({
    description: "The timestamp when the order book was last updated",
    example: "2024-03-20T12:00:00Z",
  })
  lastUpdated: Date;
}
