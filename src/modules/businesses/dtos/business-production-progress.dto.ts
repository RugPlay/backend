import { ApiProperty } from "@nestjs/swagger";
import { BusinessOutputDto } from "./business-output.dto";

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
    description: "Accumulated production time in seconds",
    example: 7200,
  })
  accumulatedTime: number;

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
}

