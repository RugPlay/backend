import { ApiProperty } from "@nestjs/swagger";
import { IncomingOrderDto } from "./incoming-order.dto";

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
      corporationId: "123e4567-e89b-12d3-a456-426614174000",
      quoteAssetId: "123e4567-e89b-12d3-a456-426614174000",
    },
  })
  incomingOrder: IncomingOrderDto;
}
