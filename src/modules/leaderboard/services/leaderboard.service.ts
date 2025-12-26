import { Injectable, Logger } from "@nestjs/common";
import { CorporationDao } from "@/modules/corporations/daos/corporation.dao";
import { InfluenceService } from "@/modules/influence/services/influence.service";
import { LeaderboardEntryDto } from "../dtos/leaderboard-entry.dto";
import { LeaderboardDto } from "../dtos/leaderboard.dto";

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private readonly corporationDao: CorporationDao,
    private readonly influenceService: InfluenceService,
  ) {}

  /**
   * Get influence leaderboard of corporations
   * Calculates influence on-the-fly for each corporation
   */
  async getInfluenceLeaderboard(limit: number = 100): Promise<LeaderboardDto> {
    this.logger.log(`Fetching influence leaderboard with limit ${limit}`);

    // Get all active corporations
    const corporations = await this.corporationDao.getActiveCorporations();
    
    // Calculate current influence for each (on-the-fly)
    const entries: LeaderboardEntryDto[] = await Promise.all(
      corporations.map(async (corp) => {
        try {
          const influence = await this.influenceService.getInfluenceBalance(corp.id);
          return {
            corporationId: corp.id,
            corporationName: corp.name,
            influence,
            rank: 0, // Will be set after sorting
          };
        } catch (error) {
          this.logger.warn(`Failed to get influence for corporation ${corp.id}: ${error}`);
          return {
            corporationId: corp.id,
            corporationName: corp.name,
            influence: 0,
            rank: 0,
          };
        }
      })
    );

    // Sort by influence descending
    entries.sort((a, b) => b.influence - a.influence);
    
    // Assign ranks (1-based)
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Apply limit
    const limitedEntries = entries.slice(0, limit);

    return {
      entries: limitedEntries,
      total: entries.length,
      limit,
    };
  }

  /**
   * Get leaderboard position for a specific corporation
   */
  async getCorporationRank(corporationId: string): Promise<{
    rank: number;
    total: number;
    influence: number;
  } | null> {
    const leaderboard = await this.getInfluenceLeaderboard(10000); // Get all to find rank
    
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

