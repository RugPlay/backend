import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { OrderService } from "../src/modules/exchange/services/order.service";
import { MarketService } from "../src/modules/exchange/services/market.service";
import { AssetService } from "../src/modules/assets/services/asset.service";
import { AppModule } from "../src/app.module";
import { v4 as uuidv4 } from "uuid";
import { TestCleanupHelper } from "./helpers/test-cleanup.helper";
import { OrderBookEntryDto } from "../src/modules/exchange/dtos/order/order-book-entry.dto";

describe("OrderService (e2e)", () => {
  let app: INestApplication;
  let orderService: OrderService;
  let marketService: MarketService;
  let assetService: AssetService;
  let testMarketId: string;
  let testCorporationId: string;
  let usdAssetId: string;
  let testAssetId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({
      logger: false,
    });
    await app.init();

    orderService = moduleFixture.get<OrderService>(OrderService);
    marketService = moduleFixture.get<MarketService>(MarketService);
    assetService = moduleFixture.get<AssetService>(AssetService);

    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data after all tests are complete
    await TestCleanupHelper.cleanupTestData(app);
    
    // Close the NestJS application
    await app.close();
  });

  async function setupTestData() {
    // Create test corporation
    testCorporationId = await TestCleanupHelper.createTestCorporation(app, `Test Corp ${Date.now()}`);

    // Create test assets
    const usdAsset = await assetService.createAsset({
      symbol: "USD",
      name: "US Dollar",
      type: "currency",
      decimals: 2,
      isActive: true,
    });
    usdAssetId = usdAsset.id;

    const testAsset = await assetService.createAsset({
      symbol: "TEST",
      name: "Test Asset",
      type: "crypto",
      decimals: 8,
      isActive: true,
    });
    testAssetId = testAsset.id;

    // Give user initial USD holdings for trading
    await TestCleanupHelper.createTestAssetHolding(app, testCorporationId, usdAssetId, 1000000);

    // Create a test market
    const market = await marketService.createMarket({
      name: "Test Order Service Market",
      symbol: "TEST/USD",
      category: "crypto",
      baseAsset: "TEST",
      quoteAsset: "USD",
      baseAssetId: testAssetId,
      quoteAssetId: usdAssetId,
      minPriceIncrement: 0.01,
      minQuantityIncrement: 0.001,
      maxQuantity: 100,
      isActive: true,
      is24h: true,
      timezone: "UTC",
    });

    if (!market) {
      throw new Error("Failed to create test market");
    }
    testMarketId = market.id;
  }

  describe("Order Book Management", () => {
    it("should create an empty order book for new market", async () => {
      const orderBook = await orderService.getOrderBook(testMarketId);
      
      expect(orderBook).toMatchObject({
        marketId: testMarketId,
        bids: [],
        asks: [],
      });
      expect(orderBook.lastUpdated).toBeInstanceOf(Date);
    });

    it("should get empty order book initially", async () => {
      const orderBook = await orderService.getOrderBook(testMarketId);
      
      expect(orderBook).toMatchObject({
        marketId: testMarketId,
        bids: [],
        asks: [],
      });
    });
  });

  describe("Order Placement Without Matching", () => {
    it("should add a buy order to the order book", async () => {
      const order: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "bid",
        price: 50000,
        quantity: 1.5,
        corporationId: testCorporationId,
        quoteAssetId: usdAssetId,
      };

      const orderWithTimestamp = { ...order, timestamp: new Date() };
      const result = await orderService.addOrder(testMarketId, orderWithTimestamp);
      expect(result).toBe(true);

      // Verify order was added to order book
      const orderBook = await orderService.getOrderBook(testMarketId);
      expect(orderBook.bids).toHaveLength(1);
      expect(orderBook.bids[0]).toMatchObject({
        price: 50000,
        quantity: 1.5,
        side: "bid",
      });
    });

    it("should add a sell order to the order book", async () => {
      // Create base asset holdings for ASK order
      await TestCleanupHelper.createTestAssetHolding(app, testCorporationId, testAssetId, 2.0);

      const order: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "ask",
        price: 51000,
        quantity: 2.0,
        corporationId: testCorporationId,
        quoteAssetId: usdAssetId,
      };

      const orderWithTimestamp = { ...order, timestamp: new Date() };
      const result = await orderService.addOrder(testMarketId, orderWithTimestamp);
      expect(result).toBe(true);

      // Verify order was added to order book
      const orderBook = await orderService.getOrderBook(testMarketId);
      expect(orderBook.asks).toHaveLength(1);
      expect(orderBook.asks[0]).toMatchObject({
        price: 51000,
        quantity: 2.0,
        side: "ask",
      });
    });
  });

  describe("Order Matching Logic", () => {
    beforeEach(async () => {
      // Clear the order book before each test
      await orderService.clearOrderBook(testMarketId);
    });

    it("should match orders with exact price and quantity", async () => {
      // Create base asset holdings for the ask order
      await TestCleanupHelper.createTestAssetHolding(app, testCorporationId, testAssetId, 1.0);

      // Add a sell order first (using addOrderWithMatching so it's saved to database)
      const sellOrder: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "ask",
        price: 50000,
        quantity: 1.0,
        corporationId: testCorporationId,
        quoteAssetId: usdAssetId,
      };

      const sellResult = await orderService.addOrderWithMatching(testMarketId, sellOrder);
      // Ask order should be added without matches (no matching bid yet)
      expect(sellResult.matches).toHaveLength(0);

      // Add a matching buy order
      const buyOrder: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "bid",
        price: 50000,
        quantity: 1.0,
        corporationId: testCorporationId,
        quoteAssetId: usdAssetId,
      };

      const matchResult = await orderService.addOrderWithMatching(testMarketId, buyOrder);

      expect(matchResult.matches).toHaveLength(1);
      expect(matchResult.matches[0]).toMatchObject({
        marketId: testMarketId,
        matchedQuantity: 1.0,
        matchedPrice: 50000,
      });

      // Both orders should be completely filled
      expect(matchResult.remainingOrder).toBeFalsy();
      expect(matchResult.completedOrderIds).toHaveLength(1);
    });

    it("should handle partial fills", async () => {
      // Create base asset holdings for the ask order
      await TestCleanupHelper.createTestAssetHolding(app, testCorporationId, testAssetId, 5.0);

      // Add a large sell order (using addOrderWithMatching so it's saved to database)
      const sellOrder: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "ask",
        price: 50000,
        quantity: 5.0,
        corporationId: testCorporationId,
        quoteAssetId: usdAssetId,
      };

      const sellResult = await orderService.addOrderWithMatching(testMarketId, sellOrder);
      // Ask order should be added without matches
      expect(sellResult.matches).toHaveLength(0);

      // Add a smaller buy order
      const buyOrder: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "bid",
        price: 50000,
        quantity: 2.0,
        corporationId: testCorporationId,
        quoteAssetId: usdAssetId,
      };

      const matchResult = await orderService.addOrderWithMatching(testMarketId, buyOrder);

      expect(matchResult.matches).toHaveLength(1);
      expect(matchResult.matches[0].matchedQuantity).toBe(2.0);

      // Buy order should be completely filled, sell order partially filled
      expect(matchResult.remainingOrder).toBeFalsy();
      expect(matchResult.updatedOrders).toHaveLength(1);
      expect(matchResult.updatedOrders[0].newQuantity).toBe(3.0); // 5.0 - 2.0
    });

    it("should handle multiple matches", async () => {
      // Create base asset holdings for the ask orders (1.0 + 1.5 = 2.5)
      await TestCleanupHelper.createTestAssetHolding(app, testCorporationId, testAssetId, 2.5);

      // Add multiple sell orders at the same price (using addOrderWithMatching so they're saved to database)
      const sellOrders = [
        {
          marketId: testMarketId,
          orderId: uuidv4(),
          side: "ask" as const,
          price: 50000,
          quantity: 1.0,
          corporationId: testCorporationId,
          quoteAssetId: usdAssetId,
        },
        {
          marketId: testMarketId,
          orderId: uuidv4(),
          side: "ask" as const,
          price: 50000,
          quantity: 1.5,
          corporationId: testCorporationId,
          quoteAssetId: usdAssetId,
        },
      ];

      // Add sell orders
      for (const order of sellOrders) {
        const result = await orderService.addOrderWithMatching(testMarketId, order);
        // Ask orders should be added without matches
        expect(result.matches).toHaveLength(0);
      }

      // Add a buy order that matches both
      const buyOrder: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "bid",
        price: 50000,
        quantity: 2.5,
        corporationId: testCorporationId,
        quoteAssetId: usdAssetId,
      };

      const matchResult = await orderService.addOrderWithMatching(testMarketId, buyOrder);

      expect(matchResult.matches).toHaveLength(2);
      
      // First match should be 1.0, second should be 1.5
      expect(matchResult.matches[0].matchedQuantity).toBe(1.0);
      expect(matchResult.matches[1].matchedQuantity).toBe(1.5);

      // Buy order should be completely filled
      expect(matchResult.remainingOrder).toBeFalsy();
      
      // Both sell orders should be completely filled
      expect(matchResult.completedOrderIds).toHaveLength(2);
    });
  });

  describe("Price-Time Priority", () => {
    beforeEach(async () => {
      await orderService.clearOrderBook(testMarketId);
    });

    it("should match orders by price priority", async () => {
      // Create base asset holdings for the ask orders (1.0 + 1.0 = 2.0)
      await TestCleanupHelper.createTestAssetHolding(app, testCorporationId, testAssetId, 2.0);

      // Add sell orders at different prices (using addOrderWithMatching so they're saved to database)
      const sellOrders = [
        {
          marketId: testMarketId,
          orderId: uuidv4(),
          side: "ask" as const,
          price: 50100, // Higher price
          quantity: 1.0,
          corporationId: testCorporationId,
          quoteAssetId: usdAssetId,
        },
        {
          marketId: testMarketId,
          orderId: uuidv4(),
          side: "ask" as const,
          price: 50000, // Lower price (should match first)
          quantity: 1.0,
          corporationId: testCorporationId,
          quoteAssetId: usdAssetId,
        },
      ];

      // Add sell orders
      for (const order of sellOrders) {
        const result = await orderService.addOrderWithMatching(testMarketId, order);
        // Ask orders should be added without matches
        expect(result.matches).toHaveLength(0);
      }

      // Add a buy order that should match the lower-priced sell
      const buyOrder: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "bid",
        price: 50050, // Between the two sell prices
        quantity: 1.0,
        corporationId: testCorporationId,
        quoteAssetId: usdAssetId,
      };

      const matchResult = await orderService.addOrderWithMatching(testMarketId, buyOrder);

      expect(matchResult.matches).toHaveLength(1);
      expect(matchResult.matches[0].matchedPrice).toBe(50000); // Should match at the lower price
    });
  });

  describe("Market Data Retrieval", () => {
    it("should get all market IDs", async () => {
      const marketIds = await orderService.getMarketIds();
      expect(Array.isArray(marketIds)).toBe(true);
      expect(marketIds).toContain(testMarketId);
    });

    it("should get orders by market and side", async () => {
      // Add some test orders first
      const testOrder: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "bid",
        price: 49000,
        quantity: 2.0,
        corporationId: testCorporationId,
        quoteAssetId: usdAssetId,
      };

      const testOrderWithTimestamp = { ...testOrder, timestamp: new Date() };
      await orderService.addOrder(testMarketId, testOrderWithTimestamp);

      // Note: getOrdersBySide is now private, so we'll test through getOrderBook
      const orderBook = await orderService.getOrderBook(testMarketId);
      expect(Array.isArray(orderBook.bids)).toBe(true);
      expect(orderBook.bids.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid market ID gracefully", async () => {
      const fakeMarketId = uuidv4();
      const orderBook = await orderService.getOrderBook(fakeMarketId);
      
      // Should return empty order book for non-existent market
      expect(orderBook).toMatchObject({
        marketId: fakeMarketId,
        bids: [],
        asks: [],
      });
    });

    it("should handle invalid user ID gracefully", async () => {
      const invalidOrder: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "bid",
        price: 50000,
        quantity: 1.0,
          corporationId: "invalid-corporation-id",
        quoteAssetId: usdAssetId,
      };

      // This should handle the error gracefully
      try {
        const result = await orderService.addOrderWithMatching(testMarketId, invalidOrder);
        // If it doesn't throw, it should return a safe fallback
        expect(result).toHaveProperty("matches");
        expect(result).toHaveProperty("remainingOrder");
      } catch (error) {
        // Error is expected for invalid user or insufficient assets
        expect(error).toBeDefined();
      }
    });
  });
});
