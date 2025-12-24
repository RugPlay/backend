import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
} from "class-validator";

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
    description: "Business category",
    example: "technology",
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: "The ID of the corporation that owns this business",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  corporationId: string;

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

