import { ApiProperty } from "@nestjs/swagger";
import { IsUUID, IsNotEmpty, IsNumber, Min, IsOptional } from "class-validator";

/**
 * DTO for claiming business outputs
 */
export class ClaimOutputDto {
  @ApiProperty({
    description: "The asset ID of the output to claim (from business type recipe)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({
    description: "Number of cycles to claim (defaults to all available)",
    example: 5,
    required: false,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  cycles?: number;
}

