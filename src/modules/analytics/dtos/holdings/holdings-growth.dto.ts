import { ApiProperty } from "@nestjs/swagger";

/**
 * Holdings growth data point showing quantity changes over time
 */
export class HoldingsGrowthDto {
  @ApiProperty({
    description: "The start time of the time bucket",
    example: "2025-01-01T00:00:00Z",
  })
  timestamp: Date;

  @ApiProperty({
    description: "Total quantity of holdings at the start of this period",
    example: 10000.5,
  })
  totalQuantity: number;

  @ApiProperty({
    description: "Total quantity added in this period",
    example: 500.0,
  })
  quantityAdded: number;

  @ApiProperty({
    description: "Total quantity removed in this period",
    example: 200.0,
  })
  quantityRemoved: number;

  @ApiProperty({
    description: "Net quantity change (added - removed)",
    example: 300.0,
  })
  netQuantityChange: number;

  @ApiProperty({
    description: "Growth rate as a percentage",
    example: 3.0,
  })
  growthRate: number;
}

