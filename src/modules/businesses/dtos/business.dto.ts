import { ApiProperty } from "@nestjs/swagger";
import { BusinessType } from "../types/business-type";
import { BusinessInputDto } from "./business-input.dto";
import { BusinessOutputDto } from "./business-output.dto";

export class BusinessDto {
  @ApiProperty({
    description: "The unique identifier of the business",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Business name",
    example: "Acme Corporation",
  })
  name: string;

  @ApiProperty({
    description: "Business description",
    example: "A leading provider of innovative solutions",
    required: false,
  })
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
  category: BusinessType;

  @ApiProperty({
    description: "The ID of the corporation that owns this business",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  corporationId: string;

  @ApiProperty({
    description: "Whether the business is active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "List of input requirements for this business",
    type: [BusinessInputDto],
    required: false,
  })
  inputs?: BusinessInputDto[];

  @ApiProperty({
    description: "List of outputs produced by this business",
    type: [BusinessOutputDto],
    required: false,
  })
  outputs?: BusinessOutputDto[];

  @ApiProperty({
    description: "The timestamp when the business was created",
    example: "2024-03-20T12:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "The timestamp when the business was last updated",
    example: "2024-03-20T12:00:00Z",
  })
  updatedAt: Date;
}

