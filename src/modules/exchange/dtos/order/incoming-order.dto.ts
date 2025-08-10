import { ApiProperty } from "@nestjs/swagger";
import { OmitType } from "@nestjs/mapped-types";
import { OrderDto } from "./order.dto";

export class IncomingOrderDto extends OmitType(OrderDto, [
  "id",
  "createdAt",
  "updatedAt",
] as const) {
  @ApiProperty({
    description: "The unique identifier of the order",
    example: "ord_123e4567-e89b-12d3-a456-426614174000",
  })
  orderId: string;
}
