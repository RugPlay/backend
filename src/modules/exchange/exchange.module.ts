import { Module } from "@nestjs/common";
import { OrderService } from "./services/order.service";
import { MarketService } from "./services/market.service";
import { EventService } from "./services/event.service";
import { OrderDao } from "./daos/order.dao";
import { MarketDao } from "./daos/market.dao";
import { TradeDao } from "./daos/trade.dao";
import { MarketController } from "./controllers/market.controller";
import { OrderController } from "./controllers/order.controller";
import { RedisModule } from "@/redis/redis.module";
import { AssetsModule } from "@/modules/assets/assets.module";

@Module({
  imports: [RedisModule, AssetsModule],
  controllers: [MarketController, OrderController],
  providers: [
    OrderService,
    MarketService,
    EventService,
    OrderDao,
    MarketDao,
    TradeDao,
  ],
  exports: [
    OrderService,
    MarketService,
    EventService,
    OrderDao,
    MarketDao,
    TradeDao,
  ],
})
export class ExchangeModule {}
