import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsNumber, IsUUID, Min, IsOptional } from "class-validator";

/**
 * DTO for creating a business output production
 */
export class CreateBusinessOutputDto {
  @ApiProperty({
    description: "The ID of the asset/resource produced as output",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({
    description: "The quantity of the asset produced per production cycle",
    example: 5.0,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({
    description: "The name of the output (for display purposes)",
    example: "Wheat",
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: "Production time in seconds for one cycle",
    example: 3600,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  productionTime?: number;
}

