import { ApiProperty } from "@nestjs/swagger";

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
