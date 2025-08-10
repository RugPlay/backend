import { OmitType, PartialType } from "@nestjs/mapped-types";
import { TradeDto } from "./trade.dto";

export class UpdateTradeDto extends PartialType(
  OmitType(TradeDto, ["id", "createdAt", "updatedAt"] as const),
) {}
