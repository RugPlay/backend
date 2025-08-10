import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNumber, IsPositive } from "class-validator";

/**
 * DTO for batch order quantity updates
 */
export class BatchUpdateOrderDto {
  @ApiProperty({
    description: "Order ID to update",
    example: "order-123e4567-e89b-12d3-a456-426614174000",
  })
  @IsString()
  readonly orderId: string;

  @ApiProperty({
    description: "New quantity for the order",
    example: 50.5,
    minimum: 0.000001,
  })
  @IsNumber()
  @IsPositive()
  readonly newQuantity: number;
}
