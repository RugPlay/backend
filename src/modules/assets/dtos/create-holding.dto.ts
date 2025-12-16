import { OmitType } from "@nestjs/mapped-types";
import { HoldingDto } from "./holding.dto";

export class CreateHoldingDto extends OmitType(HoldingDto, [
  "id",
  "createdAt",
  "updatedAt",
] as const) {}

