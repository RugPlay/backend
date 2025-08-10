import { OmitType, PartialType } from "@nestjs/mapped-types";
import { OrderDto } from "./order.dto";

export class UpdateOrderDto extends PartialType(
  OmitType(OrderDto, [
    "id",
    "createdAt",
    "updatedAt",
  ] as const),
) {}
