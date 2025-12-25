import { ApiProperty } from "@nestjs/swagger";
import { BusinessOutputDto } from "./business-output.dto";
import { ProductionBatchDto } from "./production-batch.dto";

/**
 * DTO representing production progress for a business
 */
export class BusinessProductionProgressDto {
  @ApiProperty({
    description: "The business ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  businessId: string;

  @ApiProperty({
    description: "Total cycles available to claim across all batches",
    example: 5,
  })
  totalCyclesAvailable: number;

  @ApiProperty({
    description: "Total cycles still in progress",
    example: 3,
  })
  totalCyclesInProgress: number;

  @ApiProperty({
    description: "Production batches",
    type: [ProductionBatchDto],
  })
  batches: ProductionBatchDto[];

  @ApiProperty({
    description: "Available outputs that can be claimed",
    type: [BusinessOutputDto],
  })
  availableOutputs: Array<{
    output: BusinessOutputDto;
    cyclesCompleted: number;
    quantityAvailable: number;
  }>;

  @ApiProperty({
    description: "Timestamp of last update",
    example: "2024-03-20T12:00:00Z",
  })
  lastUpdated: Date;

  @ApiProperty({
    description: "Last time outputs were claimed",
    example: "2024-03-20T12:00:00Z",
    required: false,
  })
  lastClaimedAt?: Date;
}

