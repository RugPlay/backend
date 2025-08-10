import { ApiProperty } from "@nestjs/swagger";

export class OrderMatchingRequestDto {
  @ApiProperty({
    description:
      "The unique identifier of the market where matching should occur",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  marketId: string;

  @ApiProperty({
    description: "The incoming order to be matched against the order book",
    type: () => IncomingOrderDto,
    example: {
      marketId: "123e4567-e89b-12d3-a456-426614174000",
      price: 50000.5,
      quantity: 1.5,
      orderId: "ord_123e4567-e89b-12d3-a456-426614174000",
      side: "bid",
    },
  })
  incomingOrder: IncomingOrderDto;
}

export class IncomingOrderDto {
  @ApiProperty({
    description: "The unique identifier of the market this order belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  marketId: string;

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
    description: "The unique identifier of the order",
    example: "ord_123e4567-e89b-12d3-a456-426614174000",
  })
  orderId: string;

  @ApiProperty({
    description:
      "The side of the order (bid for buy orders, ask for sell orders)",
    enum: ["bid", "ask"],
    example: "bid",
  })
  side: "bid" | "ask";
}
