import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, IsUUID, IsIn } from "class-validator";
import { BusinessType } from "../types/business-type";

export class BusinessFiltersDto {
  @ApiProperty({
    description: "Filter by business name (partial match)",
    example: "Acme",
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: "Filter by business category/type",
    example: "agriculture",
    required: false,
    enum: ["agriculture", "mining"],
  })
  @IsString()
  @IsOptional()
  @IsIn(["agriculture", "mining"])
  category?: BusinessType;

  @ApiProperty({
    description: "Filter by corporation ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsUUID()
  @IsOptional()
  corporationId?: string;

  @ApiProperty({
    description: "Filter by active status",
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

