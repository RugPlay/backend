import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { v4 as uuidv4 } from "uuid";
import { TestDataHelper } from "./helpers/test-data.helper";
import { TestCleanupHelper } from "./helpers/test-cleanup.helper";

describe("Exchange (e2e)", () => {
  let app: INestApplication;
  let testMarketId: string;
  let testPortfolioId1: string;
  let testPortfolioId2: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({
      logger: false,
    });
    await app.init();

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data after all tests are complete
    await TestCleanupHelper.cleanupTestData(app);
    
    // Close the NestJS application
    await app.close();
  });

  async function setupTestData() {
    // Create test portfolios using the test helper
    testPortfolioId1 = await TestCleanupHelper.createTestPortfolio(app, uuidv4(), 1000000);
    testPortfolioId2 = await TestCleanupHelper.createTestPortfolio(app, uuidv4(), 1000000);

    // Create a test market
    const marketData = {
      name: "Test Bitcoin Market",
      symbol: "BTC/USD",
      category: "crypto",
      baseCurrency: "BTC",
      quoteCurrency: "USD",
      minPriceIncrement: 0.01,
      minQuantityIncrement: 0.001,
      maxQuantity: 100,
      isActive: true,
      is24h: true,
      timezone: "UTC",
    };

    const marketResponse = await request(app.getHttpServer())
      .post("/markets")
      .send(marketData)
      .expect(201);

    testMarketId = marketResponse.body.id;
  }

  describe("Market Creation", () => {
    it("should create a new market", async () => {
      const marketData = {
        name: "Test Ethereum Market",
        symbol: "ETH/USD",
        category: "crypto",
        baseCurrency: "ETH",
        quoteCurrency: "USD",
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        maxQuantity: 1000,
        isActive: true,
        is24h: true,
        timezone: "UTC",
      };

      const response = await request(app.getHttpServer())
        .post("/markets")
        .send(marketData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: marketData.name,
        symbol: marketData.symbol,
        category: marketData.category,
        isActive: true,
      });
      expect(response.body.id).toBeDefined();
    });

    it("should get market by id", async () => {
      const response = await request(app.getHttpServer())
        .get(`/markets/${testMarketId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testMarketId,
        name: "Test Bitcoin Market",
        symbol: "BTC/USD",
        category: "crypto",
      });
    });

    it("should list all markets", async () => {
      const response = await request(app.getHttpServer())
        .get("/markets")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(
        response.body.some((market: any) => market.id === testMarketId),
      ).toBe(true);
    });
  });

  describe("Order Book Operations", () => {
    it("should get empty order book for new market", async () => {
      const response = await request(app.getHttpServer())
        .get(`/order/${testMarketId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        marketId: testMarketId,
        bids: [],
        asks: [],
      });
      expect(response.body.lastUpdated).toBeDefined();
    });

    it("should get all market IDs", async () => {
      const response = await request(app.getHttpServer())
        .get("/order/markets")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toContain(testMarketId);
    });
  });

  describe("Order Placement and Matching", () => {
    it("should place a buy order (bid) without matching", async () => {
      const orderData = {
        side: "bid" as const,
        price: 50000,
        quantity: 1.5,
        portfolioId: testPortfolioId1,
      };

      const response = await request(app.getHttpServer())
        .post(`/order/${testMarketId}/place-order`)
        .send(orderData)
        .expect(201);

      expect(response.body).toMatchObject({
        matches: [],
        updatedOrders: [],
        completedOrderIds: [],
      });
      expect(response.body.remainingOrder).toMatchObject({
        marketId: testMarketId,
        side: "bid",
        price: 50000,
        quantity: 1.5,
        portfolioId: testPortfolioId1,
      });
    });

    it("should place a sell order (ask) without matching", async () => {
      // Create holdings for ASK order
      await TestCleanupHelper.createTestHolding(app, testPortfolioId2, testMarketId, 2.0);

      const orderData = {
        side: "ask" as const,
        price: 51000,
        quantity: 2.0,
        portfolioId: testPortfolioId2,
      };

      const response = await request(app.getHttpServer())
        .post(`/order/${testMarketId}/place-order`)
        .send(orderData)
        .expect(201);

      expect(response.body).toMatchObject({
        matches: [],
        updatedOrders: [],
        completedOrderIds: [],
      });
      expect(response.body.remainingOrder).toMatchObject({
        marketId: testMarketId,
        side: "ask",
        price: 51000,
        quantity: 2.0,
        portfolioId: testPortfolioId2,
      });
    });

    it("should show market depth after placing orders", async () => {
      const response = await request(app.getHttpServer())
        .get(`/order/${testMarketId}`)
        .expect(200);

      expect(response.body.bids).toHaveLength(1);
      expect(response.body.asks).toHaveLength(1);
      expect(response.body.bids[0]).toMatchObject({
        price: 50000,
        quantity: 1.5,
        side: "bid",
      });
      expect(response.body.asks[0]).toMatchObject({
        price: 51000,
        quantity: 2.0,
        side: "ask",
      });
    });

    it("should place multiple orders to build market depth", async () => {
      // Add more buy orders at different prices
      const buyOrders = [
        {
          side: "bid" as const,
          price: 49500,
          quantity: 1.0,
          portfolioId: testPortfolioId1,
        },
        {
          side: "bid" as const,
          price: 49000,
          quantity: 2.0,
          portfolioId: testPortfolioId1,
        },
      ];

      // Add more sell orders at different prices
      const sellOrders = [
        {
          side: "ask" as const,
          price: 51500,
          quantity: 1.5,
          portfolioId: testPortfolioId2,
        },
        {
          side: "ask" as const,
          price: 52000,
          quantity: 3.0,
          portfolioId: testPortfolioId2,
        },
      ];

      // Create holdings for new ASK orders
      // Note: The previous test already reserved 2.0 holdings for the existing ASK order
      // So we need to create additional holdings for the new orders (1.5 + 3.0 = 4.5)
      // Plus we need to account for the already reserved 2.0, so total needed is 6.5
      const totalAskQuantity = 2.0 + 1.5 + 3.0; // Reserved from previous test + new orders
      await TestCleanupHelper.createTestHolding(app, testPortfolioId2, testMarketId, totalAskQuantity);

      // Place all buy orders
      for (const order of buyOrders) {
        await request(app.getHttpServer())
          .post(`/order/${testMarketId}/place-order`)
          .send(order)
          .expect(201);
      }

      // Place all sell orders
      for (const order of sellOrders) {
        await request(app.getHttpServer())
          .post(`/order/${testMarketId}/place-order`)
          .send(order)
          .expect(201);
      }

      // Check market depth
      const response = await request(app.getHttpServer())
        .get(`/order/${testMarketId}`)
        .expect(200);

      expect(response.body.bids).toHaveLength(3);
      expect(response.body.asks).toHaveLength(3);

      // Verify bids are sorted by price descending (highest first)
      const bidPrices = response.body.bids.map((bid: any) => bid.price);
      expect(bidPrices).toEqual([50000, 49500, 49000]);

      // Verify asks are sorted by price ascending (lowest first)
      const askPrices = response.body.asks.map((ask: any) => ask.price);
      expect(askPrices).toEqual([51000, 51500, 52000]);
    });

    it("should match orders when prices cross", async () => {
      // Place a buy order that matches with the lowest ask
      const matchingOrder = {
        side: "bid" as const,
        price: 51000, // This should match with the ask at 51000
        quantity: 1.0, // Partial fill of the 2.0 ask
        portfolioId: testPortfolioId1,
      };

      const response = await request(app.getHttpServer())
        .post(`/order/${testMarketId}/place-order`)
        .send(matchingOrder)
        .expect(201);

      // Should have matches
      expect(response.body.matches).toHaveLength(1);
      expect(response.body.matches[0]).toMatchObject({
        marketId: testMarketId,
        matchedQuantity: 1.0,
        matchedPrice: 51000,
      });

      // Should have updated orders (the ask order should be partially filled)
      expect(response.body.updatedOrders).toHaveLength(1);
      expect(response.body.updatedOrders[0].newQuantity).toBe(1.0); // 2.0 - 1.0 = 1.0

      // No remaining order since it was fully matched
      expect(response.body.remainingOrder).toBeNull();
    });

    it("should show updated market depth after matching", async () => {
      const response = await request(app.getHttpServer())
        .get(`/order/${testMarketId}`)
        .expect(200);

      // The first ask should now have quantity 1.0 instead of 2.0
      expect(response.body.asks[0]).toMatchObject({
        price: 51000,
        quantity: 1.0, // Reduced from 2.0
        side: "ask",
      });

      // Bids should still have the same count (the matching bid was fully consumed)
      expect(response.body.bids).toHaveLength(3);
    });

    it("should handle complete order fill", async () => {
      // Place a buy order that completely fills the remaining ask at 51000
      const completeOrder = {
        side: "bid" as const,
        price: 51000,
        quantity: 1.0, // This should completely fill the remaining 1.0 ask
        portfolioId: testPortfolioId1,
      };

      const response = await request(app.getHttpServer())
        .post(`/order/${testMarketId}/place-order`)
        .send(completeOrder)
        .expect(201);

      // Should have matches
      expect(response.body.matches).toHaveLength(1);
      expect(response.body.matches[0].matchedQuantity).toBe(1.0);

      // Should have completed orders (the ask order should be completely filled)
      expect(response.body.completedOrderIds).toHaveLength(1);

      // No remaining order since it was fully matched
      expect(response.body.remainingOrder).toBeNull();
    });

    it("should show market depth after complete fill", async () => {
      const response = await request(app.getHttpServer())
        .get(`/order/${testMarketId}`)
        .expect(200);

      // The first ask at 51000 should be gone, next ask should be at 51500
      expect(response.body.asks).toHaveLength(2);
      expect(response.body.asks[0].price).toBe(51500);
    });
  });

  describe("Market Statistics", () => {
    it("should get market statistics", async () => {
      const response = await request(app.getHttpServer())
        .get(`/markets/${testMarketId}/stats`)
        .expect(200);

      expect(response.body).toHaveProperty("totalVolume");
      expect(response.body).toHaveProperty("lastPrice");
      expect(response.body).toHaveProperty("priceChange24h");
      expect(response.body).toHaveProperty("high24h");
      expect(response.body).toHaveProperty("low24h");
    });

    it("should get recent trades", async () => {
      const response = await request(app.getHttpServer())
        .get(`/markets/${testMarketId}/recent-trades`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Should have trades from our matching tests
      expect(response.body.length).toBeGreaterThan(0);
      // Verify trade structure
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty("tradeId");
        expect(response.body[0]).toHaveProperty("marketId", testMarketId);
        expect(response.body[0]).toHaveProperty("price");
        expect(response.body[0]).toHaveProperty("quantity");
        expect(response.body[0]).toHaveProperty("type");
        expect(response.body[0]).toHaveProperty("createdAt");
      }
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for non-existent market", async () => {
      const fakeMarketId = uuidv4();
      await request(app.getHttpServer())
        .get(`/order/${fakeMarketId}`)
        .expect(404);
    });

    it("should return 400 for invalid order data", async () => {
      const invalidOrder = {
        side: "invalid",
        price: -100,
        quantity: 0,
        portfolioId: testPortfolioId1,
      };

      await request(app.getHttpServer())
        .post(`/order/${testMarketId}/place-order`)
        .send(invalidOrder)
        .expect(400);
    });

    it("should return 404 when placing order on non-existent market", async () => {
      const fakeMarketId = uuidv4();
      const validOrder = {
        side: "bid" as const,
        price: 50000,
        quantity: 1.0,
        portfolioId: testPortfolioId1,
      };

      await request(app.getHttpServer())
        .post(`/order/${fakeMarketId}/place-order`)
        .send(validOrder)
        .expect(404);
    });
  });

});
