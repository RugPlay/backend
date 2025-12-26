import { Module } from "@nestjs/common";
import { LeaderboardController } from "./controllers/leaderboard.controller";
import { LeaderboardService } from "./services/leaderboard.service";
import { LeaderboardDao } from "./daos/leaderboard.dao";
import { CorporationsModule } from "@/modules/corporations/corporations.module";
import { InfluenceModule } from "@/modules/influence/influence.module";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [CorporationsModule, InfluenceModule, ConfigModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, LeaderboardDao],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}

