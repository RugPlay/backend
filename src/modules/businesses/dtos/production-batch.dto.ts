import { ApiProperty } from "@nestjs/swagger";

/**
 * DTO representing a production batch
 */
export class ProductionBatchDto {
  @ApiProperty({
    description: "The batch ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Total cycles in this batch",
    example: 2,
  })
  cycles: number;

  @ApiProperty({
    description: "Cycles remaining (not yet claimed)",
    example: 1,
  })
  cyclesRemaining: number;

  @ApiProperty({
    description: "Input quantities used in this batch",
    example: { "wheat-asset-id": 4, "iron-asset-id": 2 },
  })
  inputQuantities: Record<string, number>;

  @ApiProperty({
    description: "When production started",
    example: "2024-01-01T10:00:00Z",
  })
  productionStartedAt: Date;

  @ApiProperty({
    description: "Seconds per cycle",
    example: 300,
  })
  cycleCompletionTime: number;

  @ApiProperty({
    description: "Current status",
    enum: ["active", "completed", "claimed"],
    example: "active",
  })
  status: "active" | "completed" | "claimed";

  @ApiProperty({
    description: "Cycles available to claim (calculated real-time)",
    example: 2,
  })
  cyclesAvailable: number;

  @ApiProperty({
    description: "When this batch was created",
    example: "2024-01-01T10:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "When this batch was last updated",
    example: "2024-01-01T10:05:00Z",
  })
  updatedAt: Date;
}

