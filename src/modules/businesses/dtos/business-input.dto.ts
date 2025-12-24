import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsNumber, IsUUID, Min } from "class-validator";

/**
 * DTO for business input requirements
 * Represents a resource/asset that a business needs to consume to operate
 */
export class BusinessInputDto {
  @ApiProperty({
    description: "The unique identifier of the input requirement",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id?: string;

  @ApiProperty({
    description: "The ID of the business this input belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  businessId: string;

  @ApiProperty({
    description: "The ID of the asset/resource required as input",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({
    description: "The quantity of the asset required per production cycle",
    example: 10.5,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({
    description: "The name of the input (for display purposes)",
    example: "Water",
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  name?: string;
}

