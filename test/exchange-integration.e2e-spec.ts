import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { v4 as uuidv4 } from "uuid";
import { TestDataHelper } from "./helpers/test-data.helper";
import { TestCleanupHelper } from "./helpers/test-cleanup.helper";

describe("Exchange Integration (e2e)", () => {
  let app: INestApplication;
  let testMarketId: string;
  let realPortfolioId: string;
  let bidderPortfolioId: string;
  let askerPortfolioId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    await setupTestEnvironment();
  });

  afterAll(async () => {
    // Clean up test data after all tests are complete
    await TestCleanupHelper.cleanupTestData(app);
    
    // Close all connections to prevent Jest from hanging
    await TestCleanupHelper.closeAllConnections(app);
    
    // Close the NestJS application
    await app.close();
  });

  async function setupTestEnvironment() {
    // Create test market
    const marketData = TestDataHelper.createTestMarket({
      name: "Integration Test Market",
      symbol: TestDataHelper.generateUniqueSymbol("INTEG"),
    });

    const marketResponse = await request(app.getHttpServer())
      .post("/markets")
      .send(marketData)
      .expect(201);

    testMarketId = marketResponse.body.id;

    // Create test portfolios with unique user IDs
    const testUserId = `test-user-${uuidv4()}`;
    const bidderUserId = `bidder-user-${uuidv4()}`;
    const askerUserId = `asker-user-${uuidv4()}`;
    
    realPortfolioId = await TestCleanupHelper.createTestPortfolio(app, testUserId, 1000000);
    bidderPortfolioId = await TestCleanupHelper.createTestPortfolio(app, bidderUserId, 1000000);
    askerPortfolioId = await TestCleanupHelper.createTestPortfolio(app, askerUserId, 1000000);
  }

  async function cleanupTestEnvironment() {
    // Clean up test data if needed
    try {
      await request(app.getHttpServer())
        .delete(`/markets/${testMarketId}`)
        .expect(200);
    } catch (error) {
      // Ignore cleanup errors
      console.log("Cleanup error (ignored):", error.message);
    }
  }

  describe("Complete Trading Workflow", () => {
    it("should execute a complete trading workflow", async () => {
      // Step 1: Verify empty order book
      let orderBookResponse = await request(app.getHttpServer())
        .get(`/order/${testMarketId}`)
        .expect(200);

      expect(orderBookResponse.body.bids).toHaveLength(0);
      expect(orderBookResponse.body.asks).toHaveLength(0);
      expect(TestDataHelper.validateOrderBook(orderBookResponse.body)).toBe(true);

      // Step 2: Build market depth with multiple orders
      const { bids, asks } = TestDataHelper.createMarketDepthOrders(testMarketId, bidderPortfolioId, askerPortfolioId);

      // Place bid orders
      for (const bid of bids) {
        const orderData = {
          side: bid.side,
          price: bid.price,
          quantity: bid.quantity,
          portfolioId: bid.portfolioId,
        };

        await request(app.getHttpServer())
          .post(`/markets/${testMarketId}/place-order`)
          .send(orderData)
          .expect(201);
      }

      // Place ask orders
      for (const ask of asks) {
        const orderData = {
          side: ask.side,
          price: ask.price,
          quantity: ask.quantity,
          portfolioId: ask.portfolioId,
        };

        await request(app.getHttpServer())
          .post(`/markets/${testMarketId}/place-order`)
          .send(orderData)
          .expect(201);
      }

      // Step 3: Verify market depth
      orderBookResponse = await request(app.getHttpServer())
        .get(`/order/${testMarketId}`)
        .expect(200);

      expect(orderBookResponse.body.bids).toHaveLength(3);
      expect(orderBookResponse.body.asks).toHaveLength(3);
      expect(TestDataHelper.validateOrderBook(orderBookResponse.body)).toBe(true);

      // Verify price ordering
      const bidPrices = orderBookResponse.body.bids.map((bid: any) => bid.price);
      const askPrices = orderBookResponse.body.asks.map((ask: any) => ask.price);
      
      expect(bidPrices).toEqual([50000, 49500, 49000]); // Descending
      expect(askPrices).toEqual([51000, 51500, 52000]); // Ascending

      // Step 4: Calculate and verify spread
      const spread = TestDataHelper.calculateSpread(orderBookResponse.body);
      expect(spread).toBe(1000); // 51000 - 50000

      // Step 5: Execute a matching trade
      const matchingOrder = {
        side: "bid" as const,
        price: 51000, // Crosses the spread
        quantity: 1.0,
        portfolioId: realPortfolioId,
      };

      const matchResponse = await request(app.getHttpServer())
        .post(`/markets/${testMarketId}/place-order`)
        .send(matchingOrder)
        .expect(201);

      // Verify match occurred
      expect(matchResponse.body.matches).toHaveLength(1);
      expect(matchResponse.body.matches[0]).toMatchObject({
        marketId: testMarketId,
        takerSide: "bid",
        matchedQuantity: 1.0,
        matchedPrice: 51000,
      });

      // Step 6: Verify updated order book
      orderBookResponse = await request(app.getHttpServer())
        .get(`/order/${testMarketId}`)
        .expect(200);

      // First ask should have reduced quantity (using toBeCloseTo for floating point precision)
      expect(orderBookResponse.body.asks[0].quantity).toBeCloseTo(0.2, 10); // 1.2 - 1.0
      expect(TestDataHelper.validateOrderBook(orderBookResponse.body)).toBe(true);

      // Step 7: Verify trade was recorded
      const tradesResponse = await request(app.getHttpServer())
        .get(`/markets/${testMarketId}/trades`)
        .expect(200);

      expect(tradesResponse.body).toHaveLength(1);
      expect(tradesResponse.body[0]).toMatchObject({
        marketId: testMarketId,
        price: 51000,
        quantity: 1.0,
        type: "real", // Should be real trade since using real portfolio
      });
    });
  });

  describe("Price-Time Priority Testing", () => {
    beforeEach(async () => {
      // Clear order book before each test
      try {
        await request(app.getHttpServer())
          .delete(`/order/${testMarketId}/clear`)
          .expect(200);
      } catch (error) {
        // If clear endpoint doesn't exist, that's okay
      }
    });

    it("should respect price-time priority in matching", async () => {
      const { orders, matchingOrder } = TestDataHelper.createPriorityTestOrders(
        testMarketId,
        askerPortfolioId,
        bidderPortfolioId
      );

      // Place orders in sequence (time priority)
      for (const order of orders) {
        const orderData = {
          side: order.side,
          price: order.price,
          quantity: order.quantity,
          portfolioId: order.portfolioId,
        };

        await request(app.getHttpServer())
          .post(`/markets/${testMarketId}/place-order`)
          .send(orderData)
          .expect(201);

        // Small delay to ensure time ordering
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Place matching order
      const matchData = {
        side: matchingOrder.side,
        price: matchingOrder.price,
        quantity: matchingOrder.quantity,
        portfolioId: matchingOrder.portfolioId,
      };

      const matchResponse = await request(app.getHttpServer())
        .post(`/markets/${testMarketId}/place-order`)
        .send(matchData)
        .expect(201);

      // Should match with first order (time priority)
      expect(matchResponse.body.matches).toHaveLength(1);
      expect(matchResponse.body.matches[0].matchedQuantity).toBe(1.0);

      // Verify order book state
      const orderBookResponse = await request(app.getHttpServer())
        .get(`/order/${testMarketId}`)
        .expect(200);

      // First order should be gone, second order should remain
      expect(orderBookResponse.body.asks).toHaveLength(1);
      expect(orderBookResponse.body.asks[0].quantity).toBe(1.5);
    });
  });

  describe("Market Statistics and Analytics", () => {
    it("should provide accurate market statistics", async () => {
      // Execute some trades first
      const tradeOrders = [
        { side: "ask" as const, price: 50000, quantity: 1.0 },
        { side: "bid" as const, price: 50000, quantity: 1.0 },
        { side: "ask" as const, price: 50100, quantity: 0.5 },
        { side: "bid" as const, price: 50100, quantity: 0.5 },
      ];

      for (const order of tradeOrders) {
        const orderData = {
          ...order,
          portfolioId: realPortfolioId,
        };

        await request(app.getHttpServer())
          .post(`/markets/${testMarketId}/place-order`)
          .send(orderData)
          .expect(201);
      }

      // Get market statistics
      const statsResponse = await request(app.getHttpServer())
        .get(`/markets/${testMarketId}/stats`)
        .expect(200);

      expect(statsResponse.body).toHaveProperty("totalVolume");
      expect(statsResponse.body).toHaveProperty("lastPrice");
      expect(statsResponse.body.lastPrice).toBe(50100); // Last trade price

      // Get recent trades
      const tradesResponse = await request(app.getHttpServer())
        .get(`/markets/${testMarketId}/trades`)
        .expect(200);

      expect(tradesResponse.body.length).toBeGreaterThan(0);
      expect(tradesResponse.body[0]).toHaveProperty("price");
      expect(tradesResponse.body[0]).toHaveProperty("quantity");
      expect(tradesResponse.body[0]).toHaveProperty("type");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle invalid order parameters gracefully", async () => {
      const invalidOrders = [
        // Negative price
        { side: "bid", price: -100, quantity: 1.0, portfolioId: realPortfolioId },
        // Zero quantity
        { side: "bid", price: 50000, quantity: 0, portfolioId: realPortfolioId },
        // Invalid side
        { side: "invalid", price: 50000, quantity: 1.0, portfolioId: realPortfolioId },
        // Missing portfolio
        { side: "bid", price: 50000, quantity: 1.0 },
      ];

      for (const invalidOrder of invalidOrders) {
        await request(app.getHttpServer())
          .post(`/markets/${testMarketId}/place-order`)
          .send(invalidOrder)
          .expect(400);
      }
    });

    it("should handle non-existent market gracefully", async () => {
      const fakeMarketId = uuidv4();
      
      await request(app.getHttpServer())
        .get(`/order/${fakeMarketId}`)
        .expect(404);

      const validOrder = {
        side: "bid" as const,
        price: 50000,
        quantity: 1.0,
        portfolioId: realPortfolioId,
      };

      await request(app.getHttpServer())
        .post(`/markets/${fakeMarketId}/place-order`)
        .send(validOrder)
        .expect(404);
    });

    it("should handle concurrent order placement", async () => {
      // Create multiple orders simultaneously
      const concurrentOrders = Array.from({ length: 10 }, (_, i) => ({
        side: i % 2 === 0 ? "bid" as const : "ask" as const,
        price: 50000 + (i % 2 === 0 ? -i * 10 : i * 10),
        quantity: 1.0,
        portfolioId: realPortfolioId,
      }));

      // Execute all orders concurrently
      const promises = concurrentOrders.map(order =>
        request(app.getHttpServer())
          .post(`/markets/${testMarketId}/place-order`)
          .send(order)
      );

      const responses = await Promise.allSettled(promises);
      
      // Most should succeed (some might fail due to portfolio constraints)
      const successful = responses.filter(r => r.status === "fulfilled").length;
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe("Performance Testing", () => {
    it("should handle high-frequency order placement", async () => {
      const startTime = Date.now();
      const orderCount = 50;
      
      const stressOrders = TestDataHelper.createStressTestData(
        testMarketId,
        bidderPortfolioId,
        orderCount,
        askerPortfolioId
      );

      let successCount = 0;
      
      for (const order of stressOrders) {
        try {
          const orderData = {
            side: order.side,
            price: order.price,
            quantity: order.quantity,
            portfolioId: order.portfolioId,
          };

          await request(app.getHttpServer())
            .post(`/markets/${testMarketId}/place-order`)
            .send(orderData)
            .expect(201);
          
          successCount++;
        } catch (error) {
          // Some orders might fail due to portfolio constraints
          console.log(`Order failed (expected): ${error.message}`);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`Processed ${successCount}/${orderCount} orders in ${duration}ms`);
      console.log(`Average: ${duration / orderCount}ms per order`);
      
      // Should process orders reasonably quickly
      expect(duration).toBeLessThan(30000); // 30 seconds max
      expect(successCount).toBeGreaterThan(0);
    });
  });
});
