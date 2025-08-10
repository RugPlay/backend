import { ApiProperty } from "@nestjs/swagger";

/**
 * DTO for batch trade creation response
 */
export class BatchTradeOperationResultDto {
  @ApiProperty({
    description: "Number of trades successfully created",
    example: 5,
  })
  readonly tradesCreated: number;

  @ApiProperty({
    description: "List of created trade IDs",
    type: [String],
    example: ["trade-1", "trade-2", "trade-3"],
  })
  readonly createdTradeIds: string[];
}
