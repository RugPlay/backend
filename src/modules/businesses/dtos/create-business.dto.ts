import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsIn,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { BusinessType } from "../types/business-type";
import { CreateBusinessInputDto } from "./create-business-input.dto";
import { CreateBusinessOutputDto } from "./create-business-output.dto";

export class CreateBusinessDto {
  @ApiProperty({
    description: "Business name",
    example: "Acme Corporation",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

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
    enum: [
      "agriculture",
      "mining",
      "industry_manufacturing",
      "industry_technology",
      "industry_healthcare",
      "heavy_industry",
      "power",
      "logistics",
      "commerce",
    ],
  })
  @IsString()
  @IsNotEmpty()
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
  category: BusinessType;

  @ApiProperty({
    description: "The ID of the corporation that owns this business",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  corporationId: string;

  @ApiProperty({
    description: "List of input requirements for this business",
    type: [CreateBusinessInputDto],
    required: false,
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateBusinessInputDto)
  inputs?: CreateBusinessInputDto[];

  @ApiProperty({
    description: "List of outputs produced by this business",
    type: [CreateBusinessOutputDto],
    required: false,
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateBusinessOutputDto)
  outputs?: CreateBusinessOutputDto[];

  @ApiProperty({
    description: "Whether the business is active",
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

