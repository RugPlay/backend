import { ApiProperty } from "@nestjs/swagger";

/**
 * DTO representing the result of claiming business outputs
 */
export class ClaimOutputResultDto {
  @ApiProperty({
    description: "The asset ID that was added to holdings",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  assetId: string;

  @ApiProperty({
    description: "The quantity added to corporation holdings",
    example: 10.5,
  })
  quantity: number;

  @ApiProperty({
    description: "Number of cycles claimed",
    example: 5,
  })
  cyclesClaimed: number;

  @ApiProperty({
    description: "Remaining accumulated time after claiming",
    example: 300,
  })
  remainingTime: number;
}

