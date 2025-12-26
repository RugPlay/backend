import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from "@nestjs/swagger";
import { LeaderboardService } from "../services/leaderboard.service";
import { LeaderboardDto } from "../dtos/leaderboard.dto";

@Controller("leaderboard")
@ApiTags("Leaderboard")
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get("influence")
  @ApiOperation({ summary: "Get influence leaderboard" })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Maximum number of entries to return (default: 100)",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "Leaderboard retrieved successfully",
    type: LeaderboardDto,
  })
  async getInfluenceLeaderboard(
    @Query("limit") limit?: number,
  ): Promise<LeaderboardDto> {
    const limitNum = limit ? parseInt(limit.toString(), 10) : 100;
    return this.leaderboardService.getInfluenceLeaderboard(limitNum);
  }

  @Get("influence/:corporationId/rank")
  @ApiOperation({ summary: "Get leaderboard rank for a specific corporation" })
  @ApiResponse({
    status: 200,
    description: "Rank retrieved successfully",
    schema: {
      type: "object",
      properties: {
        rank: { type: "number" },
        total: { type: "number" },
        influence: { type: "number" },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Corporation not found or has no rank" })
  async getCorporationRank(@Param("corporationId") corporationId: string) {
    const rank = await this.leaderboardService.getCorporationRank(corporationId);
    if (!rank) {
      return { rank: null, total: 0, influence: 0 };
    }
    return rank;
  }
}

