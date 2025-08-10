import { OmitType } from "@nestjs/mapped-types";
import { TradeDto } from "./trade.dto";

export class CreateTradeDto extends OmitType(TradeDto, [
  "id",
  "createdAt",
  "updatedAt",
] as const) {}
