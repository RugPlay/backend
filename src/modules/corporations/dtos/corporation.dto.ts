import { ApiProperty } from "@nestjs/swagger";

export class CorporationDto {
  @ApiProperty({
    description: "The unique identifier of the corporation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Corporation name",
    example: "Acme Corporation",
  })
  name: string;

  @ApiProperty({
    description: "Corporation description",
    example: "A leading provider of innovative solutions",
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: "Corporation industry",
    example: "technology",
  })
  industry: string;

  @ApiProperty({
    description: "Whether the corporation is active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "The timestamp when the corporation was created",
    example: "2024-03-20T12:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "The timestamp when the corporation was last updated",
    example: "2024-03-20T12:00:00Z",
  })
  updatedAt: Date;

  @ApiProperty({
    description: "Base influence amount at last update (for on-the-fly calculation)",
    example: 100.5,
    required: false,
  })
  influenceBase?: number;

  @ApiProperty({
    description: "When influence base was last updated",
    example: "2024-03-20T12:00:00Z",
    required: false,
  })
  influenceLastUpdatedAt?: Date | null;
}

