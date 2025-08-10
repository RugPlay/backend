import { OmitType } from "@nestjs/mapped-types";
import { PortfolioDto } from "./portfolio.dto";

export class CreatePortfolioDto extends OmitType(PortfolioDto, [
  "id",
  "userId",
  "holdings",
  "createdAt",
  "updatedAt",
] as const) {}
