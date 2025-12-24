import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, IsUUID, IsIn } from "class-validator";
import { BusinessType } from "../types/business-type";

export class UpdateBusinessDto {
  @ApiProperty({
    description: "Business name",
    example: "Acme Corporation",
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: "Business description",
    example: "A leading provider of innovative solutions",
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: "Business category/type",
    example: "agriculture",
    required: false,
    enum: ["agriculture", "mining"],
  })
  @IsString()
  @IsOptional()
  @IsIn([
    "agriculture",
    "mining",
    "industry_manufacturing",
    "industry_technology",
    "industry_healthcare",
    "heavy_industry",
    "power",
    "logistics",
    "commerce",
  ])
  category?: BusinessType;

  @ApiProperty({
    description: "The ID of the corporation that owns this business",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsUUID()
  @IsOptional()
  corporationId?: string;

  @ApiProperty({
    description: "Whether the business is active",
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

