import { Module } from "@nestjs/common";
import { MarketsAnalyticsController } from "./controllers/markets-analytics.controller";
import { HoldingsAnalyticsController } from "./controllers/holdings-analytics.controller";
import { MarketsAnalyticsService } from "./services/markets-analytics.service";
import { HoldingsAnalyticsService } from "./services/holdings-analytics.service";
import { MarketsAnalyticsDao } from "./daos/markets-analytics.dao";
import { HoldingsAnalyticsDao } from "./daos/holdings-analytics.dao";

@Module({
  controllers: [MarketsAnalyticsController, HoldingsAnalyticsController],
  providers: [
    MarketsAnalyticsService,
    HoldingsAnalyticsService,
    MarketsAnalyticsDao,
    HoldingsAnalyticsDao,
  ],
  exports: [
    MarketsAnalyticsService,
    HoldingsAnalyticsService,
    MarketsAnalyticsDao,
    HoldingsAnalyticsDao,
  ],
})
export class AnalyticsModule {}

