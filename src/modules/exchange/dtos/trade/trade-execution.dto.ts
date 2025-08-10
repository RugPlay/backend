import { ApiProperty, OmitType } from "@nestjs/swagger";
import { TradeDto } from "./trade.dto";

export class TradeExecutionDto extends OmitType(TradeDto, [
  "id",
  "createdAt",
  "updatedAt",
] as const) {
  @ApiProperty({
    description: "The timestamp when the trade was executed",
    example: "2024-03-20T12:00:00Z",
  })
  timestamp: Date;
}
