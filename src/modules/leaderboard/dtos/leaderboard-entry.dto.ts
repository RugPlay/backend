import { ApiProperty } from "@nestjs/swagger";

export class LeaderboardEntryDto {
  @ApiProperty({
    description: "The corporation ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  corporationId: string;

  @ApiProperty({
    description: "The corporation name",
    example: "Acme Corporation",
  })
  corporationName: string;

  @ApiProperty({
    description: "Current influence balance (calculated on-the-fly)",
    example: 100.5,
  })
  influence: number;

  @ApiProperty({
    description: "Rank position (1-based)",
    example: 1,
  })
  rank: number;
}

