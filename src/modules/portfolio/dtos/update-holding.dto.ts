import { OmitType, PartialType } from "@nestjs/mapped-types";
import { HoldingDto } from "./holding.dto";

export class UpdateHoldingDto extends PartialType(
  OmitType(HoldingDto, [
    "id",
    "createdAt",
    "updatedAt",
  ] as const),
) {}
