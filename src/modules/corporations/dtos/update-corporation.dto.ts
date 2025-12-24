import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean } from "class-validator";

export class UpdateCorporationDto {
  @ApiProperty({
    description: "Corporation name",
    example: "Acme Corporation",
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

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
    required: false,
  })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiProperty({
    description: "Whether the corporation is active",
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

