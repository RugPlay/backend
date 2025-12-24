import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
} from "class-validator";

export class CreateCorporationDto {
  @ApiProperty({
    description: "Corporation name",
    example: "Acme Corporation",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: "Corporation description",
    example: "A leading provider of innovative solutions",
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: "Corporation industry",
    example: "technology",
  })
  @IsString()
  @IsNotEmpty()
  industry: string;

  @ApiProperty({
    description: "Whether the corporation is active",
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

