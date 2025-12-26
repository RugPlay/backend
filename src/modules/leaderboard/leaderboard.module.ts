import { Module } from "@nestjs/common";
import { LeaderboardController } from "./controllers/leaderboard.controller";
import { LeaderboardService } from "./services/leaderboard.service";
import { CorporationsModule } from "@/modules/corporations/corporations.module";
import { InfluenceModule } from "@/modules/influence/influence.module";

@Module({
  imports: [CorporationsModule, InfluenceModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}

