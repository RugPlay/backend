import { Module } from "@nestjs/common";
import { OrderBookService } from "./services/order-book.service";
import { MarketService } from "./services/market.service";
import { OrderMatchingService } from "./services/order-matching.service";
import { EventService } from "./services/event.service";
import { OrderDao } from "./daos/order.dao";
import { MarketDao } from "./daos/market.dao";
import { TradeDao } from "./daos/trade.dao";
import { MarketController } from "./controllers/market.controller";
import { OrderBookController } from "./controllers/order-book.controller";

import { RedisModule } from "@/redis/redis.module";

@Module({
  imports: [RedisModule],
  controllers: [MarketController, OrderBookController],
  providers: [
    OrderBookService,
    MarketService,
    OrderMatchingService,
    EventService,
    OrderDao,
    MarketDao,
    TradeDao,
  ],
  exports: [
    OrderBookService,
    MarketService,
    OrderMatchingService,
    EventService,
    OrderDao,
    MarketDao,
    TradeDao,
  ],
})
export class ExchangeModule {}
