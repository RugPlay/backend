import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsNumber, IsUUID, Min } from "class-validator";

/**
 * DTO for business output production
 * Represents a resource/asset that a business produces
 */
export class BusinessOutputDto {
  @ApiProperty({
    description: "The unique identifier of the output production",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id?: string;

  @ApiProperty({
    description: "The ID of the business this output belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  businessId: string;

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
  @IsNotEmpty()
  name?: string;

  @ApiProperty({
    description: "Production time in seconds for one cycle",
    example: 3600,
    required: false,
  })
  @IsNumber()
  @Min(0)
  productionTime?: number;
}

