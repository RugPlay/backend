import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, IsUUID } from "class-validator";

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
    description: "Business category",
    example: "technology",
    required: false,
  })
  @IsString()
  @IsOptional()
  category?: string;

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

