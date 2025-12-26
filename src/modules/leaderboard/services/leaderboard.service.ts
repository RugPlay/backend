import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CorporationDao } from "@/modules/corporations/daos/corporation.dao";
import { InfluenceService } from "@/modules/influence/services/influence.service";
import { LeaderboardDao } from "../daos/leaderboard.dao";
import { LeaderboardEntryDto } from "../dtos/leaderboard-entry.dto";
import { LeaderboardDto } from "../dtos/leaderboard.dto";

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private readonly leaderboardDao: LeaderboardDao,
    private readonly corporationDao: CorporationDao,
    private readonly influenceService: InfluenceService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get current influence leaderboard (real-time)
   * Calculates influence on-the-fly using SQL for performance
   */
  async getCurrentInfluenceLeaderboard(limit: number = 100): Promise<LeaderboardDto> {
    this.logger.log(`Fetching current influence leaderboard with limit ${limit}`);

    const deteriorationAmount = this.configService.get<number>('influence.deteriorationAmount') || 1.0;
    const intervalSeconds = this.configService.get<number>('influence.deteriorationIntervalSeconds') || 3600;

    // Get leaderboard from DAO
    const leaderboardEntries = await this.leaderboardDao.getCurrentInfluenceLeaderboard(
      limit,
      deteriorationAmount,
      intervalSeconds,
    );

    // Map to DTOs
    const entries: LeaderboardEntryDto[] = leaderboardEntries.map((entry, index) => ({
      corporationId: entry.corporation_id,
      corporationName: entry.corporation_name,
      influence: entry.current_influence,
      rank: index + 1,
    }));

    return {
      entries,
      total: entries.length,
      limit,
    };
  }

  /**
   * Get all-time influence leaderboard (highest influence ever achieved)
   */
  async getAllTimeInfluenceLeaderboard(limit: number = 100): Promise<LeaderboardDto> {
    this.logger.log(`Fetching all-time influence leaderboard with limit ${limit}`);

    const leaderboardEntries = await this.leaderboardDao.getAllTimeInfluenceLeaderboard(limit);

    const entries: LeaderboardEntryDto[] = leaderboardEntries.map((entry, index) => ({
      corporationId: entry.corporation_id,
      corporationName: entry.corporation_name,
      influence: entry.current_influence,
      rank: index + 1,
    }));

    return {
      entries,
      total: entries.length,
      limit,
    };
  }

  /**
   * Get 24-hour influence leaderboard (highest influence in last 24 hours)
   */
  async get24HourInfluenceLeaderboard(limit: number = 100): Promise<LeaderboardDto> {
    this.logger.log(`Fetching 24-hour influence leaderboard with limit ${limit}`);

    const leaderboardEntries = await this.leaderboardDao.get24HourInfluenceLeaderboard(limit);

    const entries: LeaderboardEntryDto[] = leaderboardEntries.map((entry, index) => ({
      corporationId: entry.corporation_id,
      corporationName: entry.corporation_name,
      influence: entry.current_influence,
      rank: index + 1,
    }));

    return {
      entries,
      total: entries.length,
      limit,
    };
  }

  /**
   * Get weekly influence leaderboard (highest influence in last 7 days)
   */
  async getWeeklyInfluenceLeaderboard(limit: number = 100): Promise<LeaderboardDto> {
    this.logger.log(`Fetching weekly influence leaderboard with limit ${limit}`);

    const leaderboardEntries = await this.leaderboardDao.getWeeklyInfluenceLeaderboard(limit);

    const entries: LeaderboardEntryDto[] = leaderboardEntries.map((entry, index) => ({
      corporationId: entry.corporation_id,
      corporationName: entry.corporation_name,
      influence: entry.current_influence,
      rank: index + 1,
    }));

    return {
      entries,
      total: entries.length,
      limit,
    };
  }

  /**
   * Get leaderboard position for a specific corporation (current)
   */
  async getCorporationRank(corporationId: string): Promise<{
    rank: number;
    total: number;
    influence: number;
  } | null> {
    const leaderboard = await this.getCurrentInfluenceLeaderboard(10000); // Get all to find rank
    
    const entry = leaderboard.entries.find(
      (e) => e.corporationId === corporationId
    );

    if (!entry) {
      return null;
    }

    return {
      rank: entry.rank,
      total: leaderboard.total,
      influence: entry.influence,
    };
  }
}

