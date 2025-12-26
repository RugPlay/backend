import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from "@nestjs/swagger";
import { LeaderboardService } from "../services/leaderboard.service";
import { LeaderboardDto } from "../dtos/leaderboard.dto";

@Controller("leaderboard")
@ApiTags("Leaderboard")
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get("influence/current")
  @ApiOperation({ summary: "Get current influence leaderboard (real-time)" })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Maximum number of entries to return (default: 100)",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "Current leaderboard retrieved successfully",
    type: LeaderboardDto,
  })
  async getCurrentInfluenceLeaderboard(
    @Query("limit") limit?: number,
  ): Promise<LeaderboardDto> {
    const limitNum = limit ? parseInt(limit.toString(), 10) : 100;
    return this.leaderboardService.getCurrentInfluenceLeaderboard(limitNum);
  }

  @Get("influence/all-time")
  @ApiOperation({ summary: "Get all-time influence leaderboard (highest influence ever achieved)" })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Maximum number of entries to return (default: 100)",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "All-time leaderboard retrieved successfully",
    type: LeaderboardDto,
  })
  async getAllTimeInfluenceLeaderboard(
    @Query("limit") limit?: number,
  ): Promise<LeaderboardDto> {
    const limitNum = limit ? parseInt(limit.toString(), 10) : 100;
    return this.leaderboardService.getAllTimeInfluenceLeaderboard(limitNum);
  }

  @Get("influence/24h")
  @ApiOperation({ summary: "Get 24-hour influence leaderboard (highest influence in last 24 hours)" })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Maximum number of entries to return (default: 100)",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "24-hour leaderboard retrieved successfully",
    type: LeaderboardDto,
  })
  async get24HourInfluenceLeaderboard(
    @Query("limit") limit?: number,
  ): Promise<LeaderboardDto> {
    const limitNum = limit ? parseInt(limit.toString(), 10) : 100;
    return this.leaderboardService.get24HourInfluenceLeaderboard(limitNum);
  }

  @Get("influence/weekly")
  @ApiOperation({ summary: "Get weekly influence leaderboard (highest influence in last 7 days)" })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Maximum number of entries to return (default: 100)",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "Weekly leaderboard retrieved successfully",
    type: LeaderboardDto,
  })
  async getWeeklyInfluenceLeaderboard(
    @Query("limit") limit?: number,
  ): Promise<LeaderboardDto> {
    const limitNum = limit ? parseInt(limit.toString(), 10) : 100;
    return this.leaderboardService.getWeeklyInfluenceLeaderboard(limitNum);
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

