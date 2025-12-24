import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsNumber, IsUUID, Min, IsOptional } from "class-validator";

/**
 * DTO for creating a business input requirement
 */
export class CreateBusinessInputDto {
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
  @IsOptional()
  name?: string;
}

