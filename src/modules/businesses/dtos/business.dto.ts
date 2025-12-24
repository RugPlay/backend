import { ApiProperty } from "@nestjs/swagger";

export class BusinessDto {
  @ApiProperty({
    description: "The unique identifier of the business",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Business name",
    example: "Acme Corporation",
  })
  name: string;

  @ApiProperty({
    description: "Business description",
    example: "A leading provider of innovative solutions",
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: "Business category",
    example: "technology",
  })
  category: string;

  @ApiProperty({
    description: "The ID of the corporation that owns this business",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  corporationId: string;

  @ApiProperty({
    description: "Whether the business is active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "The timestamp when the business was created",
    example: "2024-03-20T12:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "The timestamp when the business was last updated",
    example: "2024-03-20T12:00:00Z",
  })
  updatedAt: Date;
}

