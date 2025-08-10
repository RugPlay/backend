import { ApiProperty } from "@nestjs/swagger";
import { BatchUpdateOrderDto } from "./batch-update-order.dto";

/**
 * DTO for batch order operations request
 */
export class BatchOrderOperationDto {
  @ApiProperty({
    description: "List of orders to update",
    type: [BatchUpdateOrderDto],
  })
  readonly updates: BatchUpdateOrderDto[];

  @ApiProperty({
    description: "List of order IDs to delete",
    type: [String],
    example: ["order-1", "order-2", "order-3"],
  })
  readonly deletes: string[];
}
