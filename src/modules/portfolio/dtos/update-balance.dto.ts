import { PickType } from "@nestjs/mapped-types";
import { PortfolioDto } from "./portfolio.dto";

export class UpdateBalanceDto extends PickType(PortfolioDto, [
  "balance",
] as const) {}
