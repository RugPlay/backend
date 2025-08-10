import { ApiProperty } from "@nestjs/swagger";
import { MatchResultDto } from "./match-result.dto";
import { OrderBookEntryDto } from "../order/order-book-entry.dto";

export class OrderUpdateDto {
  @ApiProperty({
    description: "The order ID that was updated",
    example: "ord_123e4567-e89b-12d3-a456-426614174000",
  })
  orderId: string;

  @ApiProperty({
    description: "The new quantity for the order",
    example: 0.5,
  })
  newQuantity: number;
}

export class OrderMatchingResultDto {
  @ApiProperty({
    description: "Array of matches that occurred during the matching process",
    type: [MatchResultDto],
    example: [
      {
        marketId: "123e4567-e89b-12d3-a456-426614174000",
        takerOrderId: "ord_123e4567-e89b-12d3-a456-426614174000",
        makerOrderId: "ord_456e7890-e89b-12d3-a456-426614174001",
        takerSide: "bid",
        matchedQuantity: 1.5,
        matchedPrice: 50000.5,
        timestamp: "2024-03-20T12:00:00Z",
        takerRemainingQuantity: 0.5,
        makerRemainingQuantity: 0.0,
      },
    ],
  })
  matches: MatchResultDto[];

  @ApiProperty({
    description: "The remaining portion of the incoming order, if any",
    type: OrderBookEntryDto,
    required: false,
    example: {
      marketId: "123e4567-e89b-12d3-a456-426614174000",
      price: 50000.5,
      quantity: 0.5,
      timestamp: "2024-03-20T12:00:00Z",
      orderId: "ord_789e1234-e89b-12d3-a456-426614174002",
      side: "bid",
    },
  })
  remainingOrder?: OrderBookEntryDto;

  @ApiProperty({
    description: "Array of existing orders that were partially filled",
    type: [OrderUpdateDto],
    example: [
      {
        orderId: "ord_123e4567-e89b-12d3-a456-426614174000",
        newQuantity: 0.5,
      },
    ],
  })
  updatedOrders: OrderUpdateDto[];

  @ApiProperty({
    description: "Array of order IDs that were completely filled and removed",
    type: [String],
    example: ["ord_456e7890-e89b-12d3-a456-426614174001"],
  })
  completedOrderIds: string[];
}
