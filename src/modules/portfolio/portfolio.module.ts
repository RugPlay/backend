import { Module } from "@nestjs/common";
import { PortfolioController } from "./controllers/portfolio.controller";
import { PortfolioService } from "./services/portfolio.service";
import { PortfolioDao } from "./daos/portfolio.dao";
import { HoldingDao } from "./daos/holding.dao";
import { ExchangeModule } from "@/modules/exchange/exchange.module";

@Module({
  imports: [ExchangeModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioDao, HoldingDao],
  exports: [PortfolioService, PortfolioDao, HoldingDao],
})
export class PortfolioModule {}
