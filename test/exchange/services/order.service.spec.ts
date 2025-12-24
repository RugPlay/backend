import { Test, TestingModule } from "@nestjs/testing";
import { OrderService } from "../../../src/modules/exchange/services/order.service";
import { OrderDao } from "../../../src/modules/exchange/daos/order.dao";
import { TradeDao } from "../../../src/modules/exchange/daos/trade.dao";
import { EventService } from "../../../src/modules/exchange/services/event.service";
import { AssetHoldingDao } from "../../../src/modules/assets/daos/asset-holding.dao";
import { MarketService } from "../../../src/modules/exchange/services/market.service";
import { REDIS_CLIENT } from "../../../src/redis/constants/redis.constants";
import { OrderBookEntryDto } from "../../../src/modules/exchange/dtos/order/order-book-entry.dto";
import { OrderMatchingResultDto } from "../../../src/modules/exchange/dtos/order/order-matching-result.dto";
import { MarketDto } from "../../../src/modules/exchange/dtos/market/market.dto";
import { HttpException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import Redis from "ioredis";

describe("OrderService", () => {
  let service: OrderService;
  let orderDao: jest.Mocked<OrderDao>;
  let tradeDao: jest.Mocked<TradeDao>;
  let eventService: jest.Mocked<EventService>;
  let assetHoldingDao: jest.Mocked<AssetHoldingDao>;
  let marketService: jest.Mocked<MarketService>;
  let redis: jest.Mocked<Redis>;

  beforeEach(async () => {
    const mockPipeline = {
      zadd: jest.fn().mockReturnThis(),
      zincrby: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, "OK"], [null, "1"], [null, "OK"]]),
    };
    const mockRedis = {
      zadd: jest.fn(),
      zrem: jest.fn(),
      zrange: jest.fn(),
      zrangebyscore: jest.fn(),
      zremrangebyscore: jest.fn(),
      sadd: jest.fn(),
      smembers: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      pipeline: jest.fn().mockReturnValue(mockPipeline),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: OrderDao,
          useValue: {
            createOrder: jest.fn(),
            getOrdersByMarket: jest.fn(),
            getMarketIds: jest.fn(),
            getOrdersByMarketAndSideForMatching: jest.fn(),
            updateOrder: jest.fn(),
            deleteOrder: jest.fn(),
            getOrderById: jest.fn(),
            transaction: jest.fn(),
            transacting: jest.fn(),
          },
        },
        {
          provide: TradeDao,
          useValue: {
            createTrade: jest.fn(),
            batchCreateTrades: jest.fn(),
            transacting: jest.fn(),
          },
        },
        {
          provide: EventService,
          useValue: {
            emitOrderMatch: jest.fn(),
            emitOrderFill: jest.fn(),
            emitTradeExecution: jest.fn(),
          },
        },
        {
          provide: AssetHoldingDao,
          useValue: {
            reserveAsset: jest.fn(),
            adjustAssetQuantity: jest.fn(),
            transacting: jest.fn(),
          },
        },
        {
          provide: MarketService,
          useValue: {
            getMarketById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderDao = module.get(OrderDao);
    tradeDao = module.get(TradeDao);
    eventService = module.get(EventService);
    assetHoldingDao = module.get(AssetHoldingDao);
    marketService = module.get(MarketService);
    redis = module.get(REDIS_CLIENT);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initializeOrderBook", () => {
    it("should initialize an empty order book", async () => {
      const marketId = uuidv4();

      await service.initializeOrderBook(marketId);

      expect(redis.sadd).toHaveBeenCalledWith(
        expect.stringContaining("markets"),
        marketId
      );
    });
  });

  describe("addOrderWithMatching", () => {
    const mockMarket: MarketDto = {
      id: uuidv4(),
      name: "BTC/USD Market",
      symbol: "BTC/USD",
      category: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USD",
      baseAssetId: uuidv4(),
      quoteAssetId: uuidv4(),
      minPriceIncrement: 0.01,
      minQuantityIncrement: 0.001,
      isActive: true,
      is24h: true,
      timezone: "UTC",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should throw error if corporation ID is missing", async () => {
      const order: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: mockMarket.id,
        side: "bid",
        price: 100,
        quantity: 1,
        corporationId: "",
        orderId: uuidv4(),
        quoteAssetId: mockMarket.quoteAssetId,
      };

      await expect(
        service.addOrderWithMatching(mockMarket.id, order)
      ).rejects.toThrow(HttpException);
    });

    it("should throw error if side is invalid", async () => {
      const order: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: mockMarket.id,
        side: "invalid" as any,
        price: 100,
        quantity: 1,
        corporationId: uuidv4(),
        orderId: uuidv4(),
        quoteAssetId: mockMarket.quoteAssetId,
      };

      await expect(
        service.addOrderWithMatching(mockMarket.id, order)
      ).rejects.toThrow(HttpException);
    });

    it("should throw error if price is invalid", async () => {
      const order: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: mockMarket.id,
        side: "bid",
        price: -100,
        quantity: 1,
        corporationId: uuidv4(),
        orderId: uuidv4(),
        quoteAssetId: mockMarket.quoteAssetId,
      };

      await expect(
        service.addOrderWithMatching(mockMarket.id, order)
      ).rejects.toThrow(HttpException);
    });

    it("should throw error if quantity is invalid", async () => {
      const order: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: mockMarket.id,
        side: "bid",
        price: 100,
        quantity: 0,
        corporationId: uuidv4(),
        orderId: uuidv4(),
        quoteAssetId: mockMarket.quoteAssetId,
      };

      await expect(
        service.addOrderWithMatching(mockMarket.id, order)
      ).rejects.toThrow(HttpException);
    });

    it("should throw error if market not found", async () => {
      const quoteAssetId = uuidv4();
      const order: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: uuidv4(),
        side: "bid",
        price: 100,
        quantity: 1,
        corporationId: uuidv4(),
        orderId: uuidv4(),
        quoteAssetId,
      };

      marketService.getMarketById.mockResolvedValue(null);

      await expect(
        service.addOrderWithMatching(order.marketId, order)
      ).rejects.toThrow(HttpException);
    });

    it("should throw error if insufficient holdings for ask order", async () => {
      const order: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: mockMarket.id,
        side: "ask",
        price: 100,
        quantity: 1,
        corporationId: uuidv4(),
        orderId: uuidv4(),
        quoteAssetId: mockMarket.quoteAssetId,
      };

      marketService.getMarketById.mockResolvedValue(mockMarket);
      assetHoldingDao.reserveAsset.mockResolvedValue(false);

      await expect(
        service.addOrderWithMatching(mockMarket.id, order)
      ).rejects.toThrow(HttpException);
    });

    it("should throw error if insufficient balance for bid order", async () => {
      const order: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: mockMarket.id,
        side: "bid",
        price: 100,
        quantity: 1,
        corporationId: uuidv4(),
        orderId: uuidv4(),
        quoteAssetId: mockMarket.quoteAssetId,
      };

      marketService.getMarketById.mockResolvedValue(mockMarket);
      assetHoldingDao.reserveAsset.mockResolvedValue(false);

      await expect(
        service.addOrderWithMatching(mockMarket.id, order)
      ).rejects.toThrow(HttpException);
    });

    it("should reserve assets for ask order", async () => {
      const order: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: mockMarket.id,
        side: "ask",
        price: 100,
        quantity: 1,
        corporationId: uuidv4(),
        orderId: uuidv4(),
        quoteAssetId: mockMarket.quoteAssetId,
      };

      marketService.getMarketById.mockResolvedValue(mockMarket);
      assetHoldingDao.reserveAsset.mockResolvedValue(true);
      orderDao.createOrder.mockResolvedValue(uuidv4());
      orderDao.transaction.mockImplementation(async (callback: any) => {
        const mockKysely = {} as any;
        const mockTrx = {
          instance: jest.fn().mockReturnValue(mockKysely),
        } as any;
        const mockOrderDaoTrx = {
          ...orderDao,
          updateOrderQuantity: jest.fn().mockResolvedValue(true),
          getOrdersByMarketAndSideForMatching: jest.fn().mockResolvedValue([]),
        };
        orderDao.transacting = jest.fn().mockReturnValue(mockOrderDaoTrx);
        tradeDao.transacting = jest.fn().mockReturnValue(tradeDao);
        assetHoldingDao.transacting = jest.fn().mockReturnValue(assetHoldingDao);
        return callback(mockTrx);
      });

      await service.addOrderWithMatching(mockMarket.id, order);

      expect(assetHoldingDao.reserveAsset).toHaveBeenCalledWith(
        order.corporationId,
        mockMarket.baseAssetId,
        order.quantity
      );
    });

    it("should reserve quote asset for bid order", async () => {
      const order: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: mockMarket.id,
        side: "bid",
        price: 100,
        quantity: 1,
        corporationId: uuidv4(),
        orderId: uuidv4(),
        quoteAssetId: mockMarket.quoteAssetId,
      };

      marketService.getMarketById.mockResolvedValue(mockMarket);
      assetHoldingDao.reserveAsset.mockResolvedValue(true);
      orderDao.createOrder.mockResolvedValue(uuidv4());
      orderDao.transaction.mockImplementation(async (callback: any) => {
        const mockKysely = {} as any;
        const mockTrx = {
          instance: jest.fn().mockReturnValue(mockKysely),
        } as any;
        const mockOrderDaoTrx = {
          ...orderDao,
          updateOrderQuantity: jest.fn().mockResolvedValue(true),
          getOrdersByMarketAndSideForMatching: jest.fn().mockResolvedValue([]),
        };
        orderDao.transacting = jest.fn().mockReturnValue(mockOrderDaoTrx);
        tradeDao.transacting = jest.fn().mockReturnValue(tradeDao);
        assetHoldingDao.transacting = jest.fn().mockReturnValue(assetHoldingDao);
        return callback(mockTrx);
      });

      await service.addOrderWithMatching(mockMarket.id, order);

      expect(assetHoldingDao.reserveAsset).toHaveBeenCalledWith(
        order.corporationId,
        mockMarket.quoteAssetId,
        100 // price * quantity
      );
    });
  });

  describe("getOrderBook", () => {
    it("should return order book from Redis", async () => {
      const marketId = uuidv4();
      const mockBids = [
        { price: 100, quantity: 1 },
        { price: 99, quantity: 2 },
      ];
      const mockAsks = [
        { price: 101, quantity: 1 },
        { price: 102, quantity: 2 },
      ];

      redis.zrange.mockImplementation((key: string) => {
        if (key.includes("bid")) {
          return Promise.resolve(
            mockBids.map((o) => JSON.stringify(o))
          );
        }
        if (key.includes("ask")) {
          return Promise.resolve(
            mockAsks.map((o) => JSON.stringify(o))
          );
        }
        return Promise.resolve([]);
      });

      const result = await service.getOrderBook(marketId);

      expect(result).toBeDefined();
      expect(result.bids).toBeDefined();
      expect(result.asks).toBeDefined();
    });
  });

  describe("cancelOrder", () => {
    it("should cancel an order and restore assets", async () => {
      const marketId = uuidv4();
      const orderId = uuidv4();
      const corporationId = uuidv4();
      const mockMarket: MarketDto = {
        id: marketId,
        name: "BTC/USD Market",
        symbol: "BTC/USD",
        category: "crypto",
        baseAsset: "BTC",
        quoteAsset: "USD",
        baseAssetId: uuidv4(),
        quoteAssetId: uuidv4(),
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        isActive: true,
        is24h: true,
        timezone: "UTC",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockOrder = {
        id: orderId,
        marketId,
        side: "ask",
        price: 100,
        quantity: 1,
        corporationId,
      };

      orderDao.getOrderById.mockResolvedValue({
        ...mockOrder,
        side: "ask",
      } as any);
      marketService.getMarketById.mockResolvedValue(mockMarket);
      orderDao.deleteOrder.mockResolvedValue(true);
      assetHoldingDao.adjustAssetQuantity.mockResolvedValue(true);
      redis.get.mockResolvedValue(JSON.stringify(mockOrder));
      redis.zincrby = jest.fn().mockResolvedValue("0");
      redis.del.mockResolvedValue(1);

      const result = await service.removeOrder(marketId, orderId, "ask");

      expect(result).toBe(true);
      expect(orderDao.deleteOrder).toHaveBeenCalledWith(orderId);
      expect(assetHoldingDao.adjustAssetQuantity).toHaveBeenCalled();
    });
  });
});

