import { OmitType, PartialType } from "@nestjs/mapped-types";
import { PortfolioDto } from "./portfolio.dto";

export class UpdatePortfolioDto extends PartialType(
  OmitType(PortfolioDto, [
    "id",
    "userId",
    "holdings",
    "createdAt",
    "updatedAt",
  ] as const),
) {}
