import { ApiProperty } from "@nestjs/swagger";
import { LeaderboardEntryDto } from "./leaderboard-entry.dto";

export class LeaderboardDto {
  @ApiProperty({
    description: "List of leaderboard entries",
    type: [LeaderboardEntryDto],
  })
  entries: LeaderboardEntryDto[];

  @ApiProperty({
    description: "Total number of corporations",
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: "Current page limit",
    example: 100,
  })
  limit: number;
}

