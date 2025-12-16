import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { v4 as uuidv4 } from "uuid";
import { TestDataHelper } from "./helpers/test-data.helper";
import { TestCleanupHelper } from "./helpers/test-cleanup.helper";
import { UserAssetStateTracker } from "./helpers/user-asset-state-tracker.helper";
import { AssetService } from "../src/modules/assets/services/asset.service";
import { AssetHoldingDao } from "../src/modules/assets/daos/asset-holding.dao";
import { OrderService } from "../src/modules/exchange/services/order.service";
import { MarketService } from "../src/modules/exchange/services/market.service";
import { TradeDao } from "../src/modules/exchange/daos/trade.dao";

describe("Exchange Integration (e2e)", () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let testMarketId: string;
  let realUserId: string;
  let bidderUserId: string;
  let askerUserId: string;
  let usdAssetId: string;
  let testAssetId: string;

  // Test helper functions
  const TestHelpers = {
    /**
     * Clear the order book for a market (test-only operation)
     */
    async clearOrderBook(marketId: string): Promise<void> {
      try {
        const orderService = moduleFixture.get<OrderService>(OrderService);
        // Use the service method directly (test-only, not exposed via API)
        await orderService.clearOrderBook(marketId);
      } catch (error) {
        // Ignore cleanup errors - market might not exist or already empty
        console.log("Order book clear warning (ignored):", error.message);
      }
    },

    /**
     * Clear all trades for a market (test-only operation)
     */
    async clearTrades(marketId: string): Promise<void> {
      try {
        const tradeDao = moduleFixture.get<TradeDao>(TradeDao);
        await tradeDao.deleteTradesByMarket(marketId);
      } catch (error) {
        // Ignore cleanup errors - market might not exist or already empty
        console.log("Trades clear warning (ignored):", error.message);
      }
    },

    /**
     * Reset all test users to a known state
     */
    async resetAllUsers(usdQuantity: number = 1000000): Promise<void> {
      await Promise.all([
        TestCleanupHelper.resetAssetQuantity(app, bidderUserId, usdAssetId, usdQuantity),
        TestCleanupHelper.resetAssetQuantity(app, askerUserId, usdAssetId, usdQuantity),
        TestCleanupHelper.resetAssetQuantity(app, realUserId, usdAssetId, usdQuantity),
      ]);
    },

    /**
     * @deprecated Use resetAllUsers instead
     */
    async resetAllPortfolios(usdQuantity: number = 1000000): Promise<void> {
      return this.resetAllUsers(usdQuantity);
    },

    /**
     * Get the order book for a market
     */
    async getOrderBook(marketId: string) {
      const response = await request(app.getHttpServer())
        .get(`/order/${marketId}`)
        .expect(200);
      return response.body;
    },

    /**
     * Place an order and return the supertest Test object
     */
    placeOrder(
      marketId: string,
      order: { side: "bid" | "ask"; price: number; quantity: number; userId: string; quoteAssetId: string }
    ) {
      return request(app.getHttpServer())
        .post(`/order/${marketId}/place-order`)
        .send(order);
    },

    /**
     * Place an order and return the response body
     */
    async placeOrderAndGetResponse(
      marketId: string,
      order: { side: "bid" | "ask"; price: number; quantity: number; userId: string; quoteAssetId: string }
    ) {
      const response = await request(app.getHttpServer())
        .post(`/order/${marketId}/place-order`)
        .send(order);
      return response;
    },

    /**
     * Place multiple orders sequentially
     */
    async placeOrdersSequentially(
      marketId: string,
      orders: Array<{ side: "bid" | "ask"; price: number; quantity: number; userId: string; quoteAssetId: string }>,
      delayMs: number = 10
    ) {
      for (const order of orders) {
        await TestHelpers.placeOrder(marketId, order).expect(201);
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    },

    /**
     * Ensure user has minimum base asset holdings for a market
     */
    async ensureMinimumBaseAsset(
      userId: string,
      assetId: string,
      minimumQuantity: number,
      tracker: UserAssetStateTracker
    ): Promise<void> {
      const state = tracker.getExpectedState(userId);
      const currentQuantity = state?.startingAssets[assetId] || 0;

      if (currentQuantity < minimumQuantity) {
        const needed = minimumQuantity - currentQuantity;
        await TestCleanupHelper.createTestAssetHolding(app, userId, assetId, needed);
        await tracker.registerUserFromCurrentState(app, userId);
      }
    },

    /**
     * Ensure user has minimum quote asset holdings
     */
    async ensureMinimumQuoteAsset(
      userId: string,
      assetId: string,
      minimumQuantity: number,
      tracker: UserAssetStateTracker
    ): Promise<void> {
      await TestCleanupHelper.ensureMinimumAssetQuantity(app, userId, assetId, minimumQuantity);
      await tracker.registerUserFromCurrentState(app, userId);
    },

    /**
     * Place bid orders and track quote asset reservations
     */
    async placeBidOrdersWithTracking(
      marketId: string,
      orders: Array<{ side: "bid" | "ask"; price: number; quantity: number; userId: string; quoteAssetId: string }>,
      tracker: UserAssetStateTracker,
      quoteAssetId: string
    ): Promise<void> {
      for (const order of orders) {
        const response = await TestHelpers.placeOrderAndGetResponse(marketId, order);

        if (response.status !== 201) {
          // Retry after ensuring sufficient quote asset
          const state = tracker.getExpectedState(order.userId);
          const needed = order.price * order.quantity;
          if ((state?.expectedAssets[quoteAssetId] || 0) < needed) {
            await TestHelpers.ensureMinimumQuoteAsset(order.userId, quoteAssetId, needed + 10000, tracker);
            await TestHelpers.placeOrder(marketId, order).expect(201);
          } else {
            throw new Error(`Order failed: ${JSON.stringify(response.body)}`);
          }
        }

        tracker.reserveQuoteAsset(order.userId, quoteAssetId, order.price * order.quantity);
      }
    },

    /**
     * Place ask orders and track base asset reservations
     */
    async placeAskOrdersWithTracking(
      marketId: string,
      orders: Array<{ side: "bid" | "ask"; price: number; quantity: number; userId: string; quoteAssetId: string }>,
      tracker: UserAssetStateTracker,
      baseAssetId: string
    ): Promise<void> {
      for (const order of orders) {
        await TestHelpers.placeOrder(marketId, order).expect(201);
        tracker.reserveBaseAsset(order.userId, baseAssetId, order.quantity);
      }
    },

    /**
     * Record trades from order response matches
     */
    recordTradesFromMatches(
      matches: Array<{ matchedPrice: number; matchedQuantity: number }>,
      userId: string,
      baseAssetId: string,
      quoteAssetId: string,
      side: "bid" | "ask",
      wasReserved: boolean,
      tracker: UserAssetStateTracker
    ): void {
      for (const match of matches) {
        tracker.recordTrade(userId, baseAssetId, quoteAssetId, side, match.matchedPrice, match.matchedQuantity, wasReserved);
      }
    },

    /**
     * Handle partial fill restoration in tracker
     */
    handlePartialFillRestoration(
      tracker: UserAssetStateTracker,
      userId: string,
      assetId: string,
      originalQuantity: number,
      filledQuantity: number
    ): void {
      const unfilledQuantity = originalQuantity - filledQuantity;
      if (unfilledQuantity <= 0) return;

      const state = tracker.getExpectedState(userId);
      if (!state) return;

      // System restores unfilled quantity by adding it back to the database
      // The system already restored it in the DB, so we need to update expectedAssets to reflect this
      // We don't update startingAssets because that represents the initial state
      // We reduce reservedAssets since the unfilled portion is no longer reserved
      state.reservedAssets[assetId] = Math.max(0, (state.reservedAssets[assetId] || 0) - unfilledQuantity);
      // The system restored the unfilled quantity in the DB, so expectedAssets should increase by that amount
      state.expectedAssets[assetId] = (state.expectedAssets[assetId] || 0) + unfilledQuantity;
    },

    /**
     * Verify order book structure and ordering
     */
    verifyOrderBookStructure(orderBook: any, expectedBidCount?: number, expectedAskCount?: number): void {
      expect(TestDataHelper.validateOrderBook(orderBook)).toBe(true);
      if (expectedBidCount !== undefined) {
        expect(orderBook.bids).toHaveLength(expectedBidCount);
      }
      if (expectedAskCount !== undefined) {
        expect(orderBook.asks).toHaveLength(expectedAskCount);
      }
    },

    /**
     * Verify order book price ordering
     */
    verifyOrderBookPriceOrdering(orderBook: any, expectedBidPrices?: number[], expectedAskPrices?: number[]): void {
      if (expectedBidPrices) {
        const bidPrices = orderBook.bids.map((bid: any) => bid.price);
        expect(bidPrices).toEqual(expectedBidPrices);
      }
      if (expectedAskPrices) {
        const askPrices = orderBook.asks.map((ask: any) => ask.price);
        expect(askPrices).toEqual(expectedAskPrices);
      }
    },

    /**
     * Verify trade was recorded correctly
     */
    async verifyTradeRecorded(marketId: string, expectedPrice: number, expectedQuantity: number): Promise<void> {
      const tradesResponse = await request(app.getHttpServer())
        .get(`/markets/${marketId}/trades`)
        .expect(200);

      expect(tradesResponse.body.length).toBeGreaterThan(0);
      const trade = tradesResponse.body.find(
        (t: any) => t.price === expectedPrice && t.quantity === expectedQuantity
      );
      expect(trade).toBeDefined();
      expect(trade).toMatchObject({
        marketId,
        price: expectedPrice,
        quantity: expectedQuantity,
        type: "real",
      });
    },
  };

  // Setup and teardown
  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({
      logger: false,
    });
    
    await app.init();
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await TestCleanupHelper.cleanupTestData(app);
    await app.close();
  });

  async function setupTestEnvironment() {
    // Create test assets
    const assets = await TestCleanupHelper.createTestAssets(app);
    usdAssetId = assets.usdAssetId;
    
    // Create TEST asset for the market
    const assetService = moduleFixture.get<AssetService>(AssetService);
    const testAsset = await assetService.createAsset({
      symbol: "TEST",
      name: "Test Asset",
      type: "crypto",
      decimals: 8,
      isActive: true,
    });
    testAssetId = testAsset.id;

    // Create test user IDs
    realUserId = `test-user-${uuidv4()}`;
    bidderUserId = `bidder-user-${uuidv4()}`;
    askerUserId = `asker-user-${uuidv4()}`;

    // Give users initial USD holdings for trading
    await TestCleanupHelper.createTestAssetHolding(app, realUserId, usdAssetId, 1000000);
    await TestCleanupHelper.createTestAssetHolding(app, bidderUserId, usdAssetId, 1000000);
    await TestCleanupHelper.createTestAssetHolding(app, askerUserId, usdAssetId, 1000000);

    const marketData = TestDataHelper.createTestMarket({
      name: "Integration Test Market",
      symbol: TestDataHelper.generateUniqueSymbol("INTEG"),
      baseAsset: "TEST",
      quoteAsset: "USD",
      baseAssetId: testAssetId,
      quoteAssetId: usdAssetId,
    });

    const marketResponse = await request(app.getHttpServer())
      .post("/markets")
      .send(marketData)
      .expect(201);

    testMarketId = marketResponse.body.id;
  }

  describe("Order Book Management", () => {
    beforeEach(async () => {
      await TestHelpers.clearOrderBook(testMarketId);
      await TestHelpers.resetAllUsers();
    });

    it("should start with an empty order book", async () => {
      const orderBook = await TestHelpers.getOrderBook(testMarketId);
      TestHelpers.verifyOrderBookStructure(orderBook, 0, 0);
    });

    it("should build market depth with multiple orders", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, bidderUserId);
      await tracker.registerUserFromCurrentState(app, askerUserId);

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 6.7, tracker);

      const { bids, asks } = TestDataHelper.createMarketDepthOrders(
        testMarketId,
        bidderUserId,
        askerUserId,
        usdAssetId
      );

      const bidderTotalNeeded = bids.reduce((sum, bid) => sum + bid.price * bid.quantity, 0);
      await TestHelpers.ensureMinimumQuoteAsset(bidderUserId, usdAssetId, bidderTotalNeeded + 10000, tracker);

      await TestHelpers.placeBidOrdersWithTracking(testMarketId, bids, tracker, usdAssetId);
      await TestHelpers.placeAskOrdersWithTracking(testMarketId, asks, tracker, testAssetId);

      const orderBook = await TestHelpers.getOrderBook(testMarketId);
      TestHelpers.verifyOrderBookStructure(orderBook, 3, 3);
    });

    it("should maintain correct price ordering in order book", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, bidderUserId);
      await tracker.registerUserFromCurrentState(app, askerUserId);

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 6.7, tracker);

      const { bids, asks } = TestDataHelper.createMarketDepthOrders(
        testMarketId,
        bidderUserId,
        askerUserId,
        usdAssetId
      );

      const bidderTotalNeeded = bids.reduce((sum, bid) => sum + bid.price * bid.quantity, 0);
      await TestHelpers.ensureMinimumQuoteAsset(bidderUserId, usdAssetId, bidderTotalNeeded + 10000, tracker);

      await TestHelpers.placeBidOrdersWithTracking(testMarketId, bids, tracker, usdAssetId);
      await TestHelpers.placeAskOrdersWithTracking(testMarketId, asks, tracker, testAssetId);

      const orderBook = await TestHelpers.getOrderBook(testMarketId);
      TestHelpers.verifyOrderBookPriceOrdering(orderBook, [50000, 49500, 49000], [51000, 51500, 52000]);
    });

    it("should calculate spread correctly", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, bidderUserId);
      await tracker.registerUserFromCurrentState(app, askerUserId);

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 6.7, tracker);

      const { bids, asks } = TestDataHelper.createMarketDepthOrders(
        testMarketId,
        bidderUserId,
        askerUserId,
        usdAssetId
      );

      const bidderTotalNeeded = bids.reduce((sum, bid) => sum + bid.price * bid.quantity, 0);
      await TestHelpers.ensureMinimumQuoteAsset(bidderUserId, usdAssetId, bidderTotalNeeded + 10000, tracker);

      await TestHelpers.placeBidOrdersWithTracking(testMarketId, bids, tracker, usdAssetId);
      await TestHelpers.placeAskOrdersWithTracking(testMarketId, asks, tracker, testAssetId);

      const orderBook = await TestHelpers.getOrderBook(testMarketId);
      const spread = TestDataHelper.calculateSpread(orderBook);
      expect(spread).toBe(1000); // 51000 - 50000
    });
  });

  describe("Trade Execution", () => {
    beforeEach(async () => {
      await TestHelpers.clearOrderBook(testMarketId);
      await TestHelpers.clearTrades(testMarketId);
      await TestHelpers.resetAllUsers();
      // Also reset base asset for all users to ensure clean state
      await TestCleanupHelper.resetAssetQuantity(app, askerUserId, testAssetId, 0);
      await TestCleanupHelper.resetAssetQuantity(app, bidderUserId, testAssetId, 0);
      await TestCleanupHelper.resetAssetQuantity(app, realUserId, testAssetId, 0);
    });

    it("should execute a matching trade when orders cross", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, askerUserId);
      await tracker.registerUserFromCurrentState(app, realUserId);

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 1.2, tracker);
      await TestHelpers.ensureMinimumQuoteAsset(realUserId, usdAssetId, 51000 + 10000, tracker);

      // Place ask order
      await TestHelpers.placeOrder(testMarketId, {
        side: "ask",
        price: 51000,
        quantity: 1.2,
        userId: askerUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      // Place matching bid order
      tracker.reserveQuoteAsset(realUserId, usdAssetId, 51000 * 1.0);
      const matchResponse = await TestHelpers.placeOrder(testMarketId, {
        side: "bid",
        price: 51000,
        quantity: 1.0,
        userId: realUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      expect(matchResponse.body.matches).toHaveLength(1);
      expect(matchResponse.body.matches[0]).toMatchObject({
        marketId: testMarketId,
        matchedQuantity: 1.0,
        matchedPrice: 51000,
      });
    });

    it("should update order book after partial fill", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, askerUserId);
      await tracker.registerUserFromCurrentState(app, realUserId);

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 1.2, tracker);
      await TestHelpers.ensureMinimumQuoteAsset(realUserId, usdAssetId, 51000 + 10000, tracker);

      // Place ask order
      await TestHelpers.placeOrder(testMarketId, {
        side: "ask",
        price: 51000,
        quantity: 1.2,
        userId: askerUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      // Place matching bid order (partial fill)
      await TestHelpers.placeOrder(testMarketId, {
        side: "bid",
        price: 51000,
        quantity: 1.0,
        userId: realUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      const orderBook = await TestHelpers.getOrderBook(testMarketId);
      expect(orderBook.asks[0].quantity).toBeCloseTo(0.2, 10); // 1.2 - 1.0
      TestHelpers.verifyOrderBookStructure(orderBook);
    });

    it("should record trades correctly", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, askerUserId);
      await tracker.registerUserFromCurrentState(app, realUserId);

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 1.0, tracker);
      await TestHelpers.ensureMinimumQuoteAsset(realUserId, usdAssetId, 51000 + 10000, tracker);

      // Place ask order
      await TestHelpers.placeOrder(testMarketId, {
        side: "ask",
        price: 51000,
        quantity: 1.0,
        userId: askerUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      // Place matching bid order
      await TestHelpers.placeOrder(testMarketId, {
        side: "bid",
        price: 51000,
        quantity: 1.0,
        userId: realUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      await TestHelpers.verifyTradeRecorded(testMarketId, 51000, 1.0);
    });

    it("should create trades for all matches and transfer assets correctly", async () => {
      const tracker = new UserAssetStateTracker();
      
      // Reset base asset to exactly 3.0 to ensure clean state (not just ensure minimum)
      await TestCleanupHelper.resetAssetQuantity(app, askerUserId, testAssetId, 3.0);
      
      // Register to get accurate starting state
      
      // Verify the base asset was actually created in the database
      const assetHoldingDao = moduleFixture.get(AssetHoldingDao);
      const askerBaseAssetBeforeOrders = await assetHoldingDao.getAsset(askerUserId, testAssetId);
      const askerBaseAssetQuantityBeforeOrders = askerBaseAssetBeforeOrders ? parseFloat(askerBaseAssetBeforeOrders.quantity.toString()) : 0;
      expect(askerBaseAssetQuantityBeforeOrders).toBeGreaterThanOrEqual(3.0);
      
      // Now register users to get accurate starting state
      await tracker.registerUserFromCurrentState(app, askerUserId);
      await tracker.registerUserFromCurrentState(app, bidderUserId);
      await tracker.registerUserFromCurrentState(app, realUserId);

      // Get starting states
      const askerStartingState = tracker.getExpectedState(askerUserId);
      const bidderStartingState = tracker.getExpectedState(bidderUserId);
      const askerStartingQuoteAsset = askerStartingState?.startingAssets[usdAssetId] || 1000000;
      const bidderStartingQuoteAsset = bidderStartingState?.startingAssets[usdAssetId] || 1000000;
      const finalAskerStartingBaseAsset = askerStartingState?.startingAssets[testAssetId] || 0;

      // Ensure sufficient quote asset for bid orders
      const totalBidCost = 50000 * 1.0 + 50000 * 1.5 + 50000 * 0.5; // 150,000
      await TestHelpers.ensureMinimumQuoteAsset(bidderUserId, usdAssetId, totalBidCost + 10000, tracker);
      await tracker.registerUserFromCurrentState(app, bidderUserId);

      // Place multiple ask orders at the same price
      const askOrders = [
        { price: 50000, quantity: 1.0 },
        { price: 50000, quantity: 1.5 },
        { price: 50000, quantity: 0.5 },
      ];

      for (const askOrder of askOrders) {
        tracker.reserveBaseAsset(askerUserId, testAssetId, askOrder.quantity);
        const response = await TestHelpers.placeOrder(testMarketId, {
          side: "ask",
          price: askOrder.price,
          quantity: askOrder.quantity,
          userId: askerUserId,
          quoteAssetId: usdAssetId,
        });
        expect(response.status).toBe(201);
        
        // Check base asset after each order to see if it's being deducted
        const assetAfterOrder = await assetHoldingDao.getAsset(askerUserId, testAssetId);
        const quantityAfterOrder = assetAfterOrder ? parseFloat(assetAfterOrder.quantity.toString()) : 0;
        console.log(`After placing ask order ${askOrder.quantity}: base asset quantity = ${quantityAfterOrder}`);
      }

      // Verify base asset was deducted after placing ask orders
      const askerBaseAssetAfterOrders = await assetHoldingDao.getAsset(askerUserId, testAssetId);
      const askerBaseAssetQuantityAfterOrders = askerBaseAssetAfterOrders ? parseFloat(askerBaseAssetAfterOrders.quantity.toString()) : 0;
      console.log(`Final base asset quantity after all orders: ${askerBaseAssetQuantityAfterOrders}`);
      // After placing 3 orders totaling 3.0, the base asset should be 3.0 - 3.0 = 0
      expect(askerBaseAssetQuantityAfterOrders).toBe(0);

      // Place a bid order that will match all three ask orders
      const totalBidQuantity = 3.0; // 1.0 + 1.5 + 0.5
      tracker.reserveQuoteAsset(bidderUserId, usdAssetId, 50000 * totalBidQuantity);
      const matchResponse = await TestHelpers.placeOrder(testMarketId, {
        side: "bid",
        price: 50000,
        quantity: totalBidQuantity,
        userId: bidderUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      // Verify we got 3 matches
      expect(matchResponse.body.matches).toHaveLength(3);
      const totalMatchedQuantity = matchResponse.body.matches.reduce(
        (sum: number, match: any) => sum + match.matchedQuantity,
        0
      );
      expect(totalMatchedQuantity).toBe(3.0);

      // Record all trades in tracker
      for (const match of matchResponse.body.matches) {
        tracker.recordTrade(bidderUserId, testAssetId, usdAssetId, "bid", match.matchedPrice, match.matchedQuantity, true);
        tracker.recordTrade(askerUserId, testAssetId, usdAssetId, "ask", match.matchedPrice, match.matchedQuantity, true);
      }

      // Verify trades were created in database
      const tradesResponse = await request(app.getHttpServer())
        .get(`/markets/${testMarketId}/trades`)
        .expect(200);

      // Should have exactly 3 trades (one for each match) - no trades from previous tests
      expect(tradesResponse.body.length).toBe(3);

      // Get all trades (should be exactly 3)
      const recentTrades = tradesResponse.body;

      // Verify each trade has correct properties
      for (const trade of recentTrades) {
        expect(trade).toHaveProperty("price");
        expect(trade).toHaveProperty("quantity");
        expect(trade).toHaveProperty("type");
        expect(trade).toHaveProperty("marketId");
        expect(trade.marketId).toBe(testMarketId);
        expect(trade.price).toBe(50000);
        expect(trade.type).toBe("real");
      }

      // Verify total quantity of trades matches total matched quantity
      const totalTradeQuantity = recentTrades.reduce(
        (sum: number, trade: any) => sum + trade.quantity,
        0
      );
      expect(totalTradeQuantity).toBeCloseTo(totalMatchedQuantity, 0.0001);

      // Verify user asset states - bidder should have spent quote asset and gained base asset
      const bidderState = await tracker.verifyUser(app, bidderUserId);
      expect(bidderState.allSuccess).toBe(true);
      
      const bidderQuoteAsset = await tracker.verifyAsset(app, bidderUserId, usdAssetId);
      expect(bidderQuoteAsset.success).toBe(true);
      expect(bidderQuoteAsset.expected).toBeCloseTo(bidderStartingQuoteAsset - 150000, 0.01); // Spent 150,000

      const bidderBaseAsset = await tracker.verifyAsset(app, bidderUserId, testAssetId);
      expect(bidderBaseAsset.success).toBe(true);
      const bidderStartingBaseAsset = bidderStartingState?.startingAssets[testAssetId] || 0;
      expect(bidderBaseAsset.expected).toBeCloseTo(bidderStartingBaseAsset + 3.0, 0.0001); // Gained 3.0

      // Verify user asset states - asker should have gained quote asset and lost base asset
      const askerState = await tracker.verifyUser(app, askerUserId);
      if (!askerState.allSuccess) {
        // Log which assets failed for debugging
        for (const [assetId, result] of askerState.assets.entries()) {
          if (!result.success) {
            console.log(`Asset ${assetId} verification failed: expected ${result.expected}, actual ${result.actual}, difference ${result.difference}`);
          }
        }
      }
      expect(askerState.allSuccess).toBe(true);
      
      const askerQuoteAsset = await tracker.verifyAsset(app, askerUserId, usdAssetId);
      expect(askerQuoteAsset.success).toBe(true);
      expect(askerQuoteAsset.expected).toBeCloseTo(askerStartingQuoteAsset + 150000, 0.01); // Gained 150,000

      // Verify that trades were created and assets were transferred correctly
      // The key verification is that:
      // 1. Number of trades matches number of matches (verified above)
      // 2. Total trade quantity matches total matched quantity (verified above)
      // 3. Assets were transferred correctly (verified above for both users)
      
      // Verify asker quote asset increased (this confirms the trade executed and assets were transferred)
      expect(askerQuoteAsset.success).toBe(true);
      expect(askerQuoteAsset.expected).toBeCloseTo(askerStartingQuoteAsset + 150000, 0.01);
      
      // Verify bidder quote asset decreased and base asset increased (this confirms the trade executed)
      expect(bidderQuoteAsset.success).toBe(true);
      expect(bidderQuoteAsset.expected).toBeCloseTo(bidderStartingQuoteAsset - 150000, 0.01);
      expect(bidderBaseAsset.success).toBe(true);
      expect(bidderBaseAsset.expected).toBeCloseTo(bidderStartingBaseAsset + 3.0, 0.0001);
    });
  });

  // Note: "Money Conservation and Portfolio Valuation" tests removed
  // as they depended on PortfolioService which has been removed.
  // Asset-based holdings tracking is now handled by UserAssetStateTracker.

  describe("User Asset State Management", () => {
    beforeEach(async () => {
      await TestHelpers.clearOrderBook(testMarketId);
      await TestHelpers.resetAllUsers();
    });

    it("should update buyer asset state after trade", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, askerUserId);
      await tracker.registerUserFromCurrentState(app, realUserId);

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 1.0, tracker);
      await TestHelpers.ensureMinimumQuoteAsset(realUserId, usdAssetId, 51000 + 10000, tracker);

      // Get starting base asset for buyer (should be 0)
      const buyerStartingState = tracker.getExpectedState(realUserId);
      const buyerStartingBaseAsset = buyerStartingState?.startingAssets[testAssetId] || 0;

      // Place ask order
      tracker.reserveBaseAsset(askerUserId, testAssetId, 1.0);
      await TestHelpers.placeOrder(testMarketId, {
        side: "ask",
        price: 51000,
        quantity: 1.0,
        userId: askerUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      // Place matching bid order
      tracker.reserveQuoteAsset(realUserId, usdAssetId, 51000 * 1.0);
      const matchResponse = await TestHelpers.placeOrder(testMarketId, {
        side: "bid",
        price: 51000,
        quantity: 1.0,
        userId: realUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      expect(matchResponse.body.matches).toHaveLength(1);

      // Record trades for both sides
      tracker.recordTrade(realUserId, testAssetId, usdAssetId, "bid", 51000, 1.0, true);
      tracker.recordTrade(askerUserId, testAssetId, usdAssetId, "ask", 51000, 1.0, true);

      const buyerState = await tracker.verifyUser(app, realUserId);
      expect(buyerState.allSuccess).toBe(true);
      
      const buyerQuoteAsset = await tracker.verifyAsset(app, realUserId, usdAssetId);
      expect(buyerQuoteAsset.success).toBe(true);
      const startingQuoteAsset = buyerStartingState?.startingAssets[usdAssetId] || 1000000;
      expect(buyerQuoteAsset.expected).toBeCloseTo(startingQuoteAsset - 51000, 0.01);

      const buyerBaseAsset = await tracker.verifyAsset(app, realUserId, testAssetId);
      expect(buyerBaseAsset.success).toBe(true);
      // Expected base asset = starting (0) + gained from trade (1.0)
      expect(buyerBaseAsset.expected).toBeCloseTo(buyerStartingBaseAsset + 1.0, 0.0001);
    });
  });

  describe("User Asset State Management", () => {
    beforeEach(async () => {
      await TestHelpers.clearOrderBook(testMarketId);
      await TestHelpers.resetAllUsers();
    });

    it("should update buyer asset state after trade", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, askerUserId);
      await tracker.registerUserFromCurrentState(app, realUserId);

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 1.0, tracker);
      await TestHelpers.ensureMinimumQuoteAsset(realUserId, usdAssetId, 51000 + 10000, tracker);

      // Get starting base asset for buyer (should be 0)
      const buyerStartingState = tracker.getExpectedState(realUserId);
      const buyerStartingBaseAsset = buyerStartingState?.startingAssets[testAssetId] || 0;

      // Place ask order
      tracker.reserveBaseAsset(askerUserId, testAssetId, 1.0);
      await TestHelpers.placeOrder(testMarketId, {
        side: "ask",
        price: 51000,
        quantity: 1.0,
        userId: askerUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      // Place matching bid order
      tracker.reserveQuoteAsset(realUserId, usdAssetId, 51000 * 1.0);
      await TestHelpers.placeOrder(testMarketId, {
        side: "bid",
        price: 51000,
        quantity: 1.0,
        userId: realUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      // Record trades for both sides
      tracker.recordTrade(realUserId, testAssetId, usdAssetId, "bid", 51000, 1.0, true);
      tracker.recordTrade(askerUserId, testAssetId, usdAssetId, "ask", 51000, 1.0, true);

      const buyerState = await tracker.verifyUser(app, realUserId);
      expect(buyerState.allSuccess).toBe(true);
      const startingQuoteAsset = buyerStartingState?.startingAssets[usdAssetId] || 1000000;
      
      const buyerQuoteAsset = await tracker.verifyAsset(app, realUserId, usdAssetId);
      expect(buyerQuoteAsset.success).toBe(true);
      expect(buyerQuoteAsset.expected).toBeCloseTo(startingQuoteAsset - 51000, 0.01);

      const buyerBaseAsset = await tracker.verifyAsset(app, realUserId, testAssetId);
      expect(buyerBaseAsset.success).toBe(true);
      // Expected base asset = starting (0) + gained from trade (1.0)
      expect(buyerBaseAsset.expected).toBeCloseTo(buyerStartingBaseAsset + 1.0, 0.0001);
    });

    it("should update seller asset state after trade", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, askerUserId);
      await tracker.registerUserFromCurrentState(app, realUserId);

      // Get initial base asset before ensuring minimum
      const initialState = tracker.getExpectedState(askerUserId);
      const initialBaseAsset = initialState?.startingAssets[testAssetId] || 0;

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 1.0, tracker);
      await TestHelpers.ensureMinimumQuoteAsset(realUserId, usdAssetId, 51000 + 10000, tracker);

      // Re-register to get updated state after ensuring minimum
      await tracker.registerUserFromCurrentState(app, askerUserId);
      const sellerStartingState = tracker.getExpectedState(askerUserId);
      const sellerStartingBaseAsset = sellerStartingState?.startingAssets[testAssetId] || 0;

      // Place ask order (this reserves base asset)
      tracker.reserveBaseAsset(askerUserId, testAssetId, 1.0);
      await TestHelpers.placeOrder(testMarketId, {
        side: "ask",
        price: 51000,
        quantity: 1.0,
        userId: askerUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      // Place matching bid order
      tracker.reserveQuoteAsset(realUserId, usdAssetId, 51000 * 1.0);
      await TestHelpers.placeOrder(testMarketId, {
        side: "bid",
        price: 51000,
        quantity: 1.0,
        userId: realUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      // Record trades for both sides
      tracker.recordTrade(askerUserId, testAssetId, usdAssetId, "ask", 51000, 1.0, true);
      tracker.recordTrade(realUserId, testAssetId, usdAssetId, "bid", 51000, 1.0, true);

      const sellerState = await tracker.verifyUser(app, askerUserId);
      expect(sellerState.allSuccess).toBe(true);
      const startingQuoteAsset = sellerStartingState?.startingAssets[usdAssetId] || 1000000;
      
      const sellerQuoteAsset = await tracker.verifyAsset(app, askerUserId, usdAssetId);
      expect(sellerQuoteAsset.success).toBe(true);
      expect(sellerQuoteAsset.expected).toBeCloseTo(startingQuoteAsset + 51000, 0.01);

      // Verify base asset decreased by the sold quantity
      const sellerBaseAsset = await tracker.verifyAsset(app, askerUserId, testAssetId);
      expect(sellerBaseAsset.success).toBe(true);
      // After a fully filled ask order, base asset should decrease by the sold quantity
      const expectedDecrease = 1.0; // Sold quantity
      const expectedBaseAssetAfterSale = sellerStartingBaseAsset - expectedDecrease;
      expect(sellerBaseAsset.expected).toBeCloseTo(expectedBaseAssetAfterSale, 0.0001);
    });

    it("should handle partial fill restoration correctly", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, askerUserId);
      await tracker.registerUserFromCurrentState(app, realUserId);

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 1.2, tracker);
      await TestHelpers.ensureMinimumQuoteAsset(realUserId, usdAssetId, 51000 + 10000, tracker);

      // Place ask order
      tracker.reserveBaseAsset(askerUserId, testAssetId, 1.2);
      await TestHelpers.placeOrder(testMarketId, {
        side: "ask",
        price: 51000,
        quantity: 1.2,
        userId: askerUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      // Place matching bid order (partial fill)
      tracker.reserveQuoteAsset(realUserId, usdAssetId, 51000 * 1.0);
      await TestHelpers.placeOrder(testMarketId, {
        side: "bid",
        price: 51000,
        quantity: 1.0,
        userId: realUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      tracker.recordTrade(askerUserId, testAssetId, usdAssetId, "ask", 51000, 1.0, true);
      TestHelpers.handlePartialFillRestoration(tracker, askerUserId, testAssetId, 1.2, 1.0);

      const sellerState = await tracker.verifyUser(app, askerUserId);
      if (!sellerState.allSuccess) {
        // Log which assets failed for debugging
        for (const [assetId, result] of sellerState.assets.entries()) {
          if (!result.success) {
            console.log(`Asset ${assetId} verification failed: expected ${result.expected}, actual ${result.actual}, difference ${result.difference}`);
          }
        }
      }
      expect(sellerState.allSuccess).toBe(true);
    });
  });

  describe("Price-Time Priority", () => {
    beforeEach(async () => {
      await TestHelpers.clearOrderBook(testMarketId);
      await TestHelpers.resetAllUsers();
    });

    it("should match with first order when multiple orders have same price", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, askerUserId);
      await tracker.registerUserFromCurrentState(app, bidderUserId);

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 2.5, tracker);

      const { orders, matchingOrder } = TestDataHelper.createPriorityTestOrders(
        testMarketId,
        askerUserId,
        bidderUserId,
        usdAssetId
      );

      // Place orders sequentially to establish time priority
      await TestHelpers.placeOrdersSequentially(testMarketId, orders);

      // Place matching order
      tracker.reserveQuoteAsset(bidderUserId, usdAssetId, matchingOrder.price * matchingOrder.quantity);
      const matchResponse = await TestHelpers.placeOrder(testMarketId, matchingOrder).expect(201);

      expect(matchResponse.body.matches).toHaveLength(1);
      expect(matchResponse.body.matches[0].matchedQuantity).toBe(1.0);
    });

    it("should leave remaining order in book after partial fill", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, askerUserId);
      await tracker.registerUserFromCurrentState(app, bidderUserId);

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 2.5, tracker);

      const { orders, matchingOrder } = TestDataHelper.createPriorityTestOrders(
        testMarketId,
        askerUserId,
        bidderUserId,
        usdAssetId
      );

      await TestHelpers.placeOrdersSequentially(testMarketId, orders);
      await TestHelpers.placeOrder(testMarketId, matchingOrder).expect(201);

      const orderBook = await TestHelpers.getOrderBook(testMarketId);
      expect(orderBook.asks).toHaveLength(1);
      expect(orderBook.asks[0].quantity).toBe(1.5);
    });

    it("should update user asset states correctly after priority match", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, askerUserId);
      await tracker.registerUserFromCurrentState(app, bidderUserId);

      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 2.5, tracker);

      // Get starting base asset for bidder (should be 0)
      const bidderStartingState = tracker.getExpectedState(bidderUserId);
      const bidderStartingBaseAsset = bidderStartingState?.startingAssets[testAssetId] || 0;

      const { orders, matchingOrder } = TestDataHelper.createPriorityTestOrders(
        testMarketId,
        askerUserId,
        bidderUserId,
        usdAssetId
      );

      // Place ask orders and track base asset reservations
      for (const order of orders) {
        tracker.reserveBaseAsset(askerUserId, testAssetId, order.quantity);
        await TestHelpers.placeOrder(testMarketId, order).expect(201);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      tracker.reserveQuoteAsset(bidderUserId, usdAssetId, matchingOrder.price * matchingOrder.quantity);
      const matchResponse = await TestHelpers.placeOrder(testMarketId, matchingOrder).expect(201);
      const match = matchResponse.body.matches[0];

      tracker.recordTrade(bidderUserId, testAssetId, usdAssetId, "bid", match.matchedPrice, match.matchedQuantity, true);
      tracker.recordTrade(askerUserId, testAssetId, usdAssetId, "ask", match.matchedPrice, match.matchedQuantity, true);

      // Handle partial fill restoration for the first ask order (1.0 filled, 0 remaining)
      TestHelpers.handlePartialFillRestoration(tracker, askerUserId, testAssetId, 1.0, 1.0);

      const bidderState = await tracker.verifyUser(app, bidderUserId);
      expect(bidderState.allSuccess).toBe(true);
      const bidderStartingQuoteAsset = bidderStartingState?.startingAssets[usdAssetId] || 1000000;
      
      const bidderQuoteAsset = await tracker.verifyAsset(app, bidderUserId, usdAssetId);
      expect(bidderQuoteAsset.success).toBe(true);
      expect(bidderQuoteAsset.expected).toBeCloseTo(bidderStartingQuoteAsset - 50000, 0.01);

      const bidderBaseAsset = await tracker.verifyAsset(app, bidderUserId, testAssetId);
      expect(bidderBaseAsset.success).toBe(true);
      // Expected base asset = starting (0) + gained from trade (1.0)
      expect(bidderBaseAsset.expected).toBeCloseTo(bidderStartingBaseAsset + 1.0, 0.0001);
    });
  });

  describe("Market Statistics", () => {
    beforeEach(async () => {
      await TestHelpers.clearOrderBook(testMarketId);
      await TestCleanupHelper.resetAssetQuantity(app, realUserId, usdAssetId, 1000000);
    });

    it("should provide accurate market statistics", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, realUserId);

      await TestHelpers.ensureMinimumBaseAsset(realUserId, testAssetId, 1.5, tracker);
      await TestHelpers.ensureMinimumQuoteAsset(realUserId, usdAssetId, 100000, tracker);

      // Execute trades
      const tradeOrders = [
        { side: "ask" as const, price: 50000, quantity: 1.0 },
        { side: "bid" as const, price: 50000, quantity: 1.0 },
        { side: "ask" as const, price: 50100, quantity: 0.5 },
        { side: "bid" as const, price: 50100, quantity: 0.5 },
      ];

      for (const order of tradeOrders) {
        if (order.side === "bid") {
          tracker.reserveQuoteAsset(realUserId, usdAssetId, order.price * order.quantity);
        }
        await TestHelpers.placeOrder(testMarketId, {
          ...order,
          userId: realUserId,
          quoteAssetId: usdAssetId,
        }).expect(201);
      }

      const statsResponse = await request(app.getHttpServer())
        .get(`/markets/${testMarketId}/stats`)
        .expect(200);

      expect(statsResponse.body).toHaveProperty("totalVolume");
      expect(statsResponse.body).toHaveProperty("lastPrice");
      expect(statsResponse.body.lastPrice).toBe(50100);
    });

    it("should record all trades in trade history", async () => {
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, realUserId);

      await TestHelpers.ensureMinimumBaseAsset(realUserId, testAssetId, 1.5, tracker);
      await TestHelpers.ensureMinimumQuoteAsset(realUserId, usdAssetId, 100000, tracker);

      const tradeOrders = [
        { side: "ask" as const, price: 50000, quantity: 1.0 },
        { side: "bid" as const, price: 50000, quantity: 1.0 },
        { side: "ask" as const, price: 50100, quantity: 0.5 },
        { side: "bid" as const, price: 50100, quantity: 0.5 },
      ];

      for (const order of tradeOrders) {
        if (order.side === "bid") {
          tracker.reserveQuoteAsset(realUserId, usdAssetId, order.price * order.quantity);
        }
        await TestHelpers.placeOrder(testMarketId, {
          ...order,
          userId: realUserId,
          quoteAssetId: usdAssetId,
        }).expect(201);
      }

      const tradesResponse = await request(app.getHttpServer())
        .get(`/markets/${testMarketId}/trades`)
        .expect(200);

      expect(tradesResponse.body.length).toBeGreaterThan(0);
      expect(tradesResponse.body[0]).toHaveProperty("price");
      expect(tradesResponse.body[0]).toHaveProperty("quantity");
      expect(tradesResponse.body[0]).toHaveProperty("type");
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      await TestHelpers.clearOrderBook(testMarketId);
    });

    it("should reject orders with negative price", async () => {
      await TestHelpers.placeOrder(testMarketId, {
        side: "bid",
        price: -100,
        quantity: 1.0,
        userId: realUserId,
        quoteAssetId: usdAssetId,
      }).expect(400);
    });

    it("should reject orders with zero quantity", async () => {
      await TestHelpers.placeOrder(testMarketId, {
        side: "bid",
        price: 50000,
        quantity: 0,
        userId: realUserId,
        quoteAssetId: usdAssetId,
      }).expect(400);
    });

    it("should reject orders with invalid side", async () => {
      await TestHelpers.placeOrder(testMarketId, {
        side: "invalid" as any,
        price: 50000,
        quantity: 1.0,
        userId: realUserId,
        quoteAssetId: usdAssetId,
      }).expect(400);
    });

    it("should reject orders with missing userId", async () => {
      await TestHelpers.placeOrder(testMarketId, {
        side: "bid",
        price: 50000,
        quantity: 1.0,
        userId: undefined as any,
        quoteAssetId: usdAssetId,
      }).expect(400);
    });

    it("should return 404 for non-existent market order book", async () => {
      const fakeMarketId = uuidv4();
      await request(app.getHttpServer())
        .get(`/order/${fakeMarketId}`)
        .expect(404);
    });

    it("should return 404 when placing order on non-existent market", async () => {
      const fakeMarketId = uuidv4();
      await TestHelpers.placeOrder(fakeMarketId, {
        side: "bid",
        price: 50000,
        quantity: 1.0,
        userId: realUserId,
        quoteAssetId: usdAssetId,
      }).expect(404);
    });
  });

  describe("Concurrency", () => {
    beforeEach(async () => {
      await TestHelpers.clearOrderBook(testMarketId);
    });

    it("should handle concurrent order placement", async () => {
      const askOrderCount = 5;
      const totalAskQuantity = askOrderCount * 1.0;
      await TestCleanupHelper.createTestAssetHolding(app, realUserId, testAssetId, totalAskQuantity);

      const concurrentOrders = Array.from({ length: 10 }, (_, i) => ({
        side: (i % 2 === 0 ? "bid" : "ask") as "bid" | "ask",
        price: Math.abs(50000 + (i % 2 === 0 ? -i * 10 : i * 10)),
        quantity: 1.0,
        userId: realUserId,
        quoteAssetId: usdAssetId,
      }));

      const responses = await Promise.all(
        concurrentOrders.map(order =>
          TestHelpers.placeOrderAndGetResponse(testMarketId, order)
          .then(res => ({ status: res.status, success: res.status === 201 }))
          .catch(err => ({ status: err.response?.status || 500, success: false }))
        )
      );

      const successful = responses.filter(r => r.success).length;
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe("Performance", () => {
    it("should handle high-frequency order placement", async () => {
      await TestHelpers.clearOrderBook(testMarketId);
      await TestHelpers.resetAllUsers();

      const startTime = Date.now();
      const orderCount = 50;
      
      const stressOrders = TestDataHelper.createStressTestData(
        testMarketId,
        bidderUserId,
        usdAssetId,
        orderCount,
        askerUserId
      );

      const totalAskQuantity = stressOrders
        .filter(order => order.side === "ask")
        .reduce((sum, order) => sum + order.quantity, 0);
      await TestCleanupHelper.createTestAssetHolding(app, askerUserId, testAssetId, totalAskQuantity);

      let successCount = 0;
      for (const order of stressOrders) {
        try {
          await TestHelpers.placeOrder(testMarketId, order).expect(201);
          successCount++;
        } catch (error) {
          // Some orders may fail due to asset constraints - this is expected in stress tests
          // Silently continue to avoid console noise
        }
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(30000);
      expect(successCount).toBeGreaterThan(0);

      await TestHelpers.clearOrderBook(testMarketId);
    });
  });

  describe("Cache Reinitialization", () => {
    beforeEach(async () => {
      await TestHelpers.clearOrderBook(testMarketId);
      await TestHelpers.resetAllPortfolios();
    });

    it("should restore order book from database after Redis cache is cleared", async () => {
      const orderService = moduleFixture.get<OrderService>(OrderService);
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, bidderUserId);
      await tracker.registerUserFromCurrentState(app, askerUserId);

      // Create base asset holdings for ask orders
      const totalAskQuantity = 6.7; // 1.5 + 2.0 + 3.2
      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, totalAskQuantity, tracker);

      // Create market depth orders
      const { bids, asks } = TestDataHelper.createMarketDepthOrders(
        testMarketId,
        bidderUserId,
        askerUserId,
        usdAssetId
      );

      // Ensure sufficient quote asset for bid orders
      const bidderTotalNeeded = bids.reduce((sum, bid) => sum + bid.price * bid.quantity, 0);
      await TestHelpers.ensureMinimumQuoteAsset(bidderUserId, usdAssetId, bidderTotalNeeded + 10000, tracker);

      // Place all orders to build up the order book
      await TestHelpers.placeBidOrdersWithTracking(testMarketId, bids, tracker, usdAssetId);
      await TestHelpers.placeAskOrdersWithTracking(testMarketId, asks, tracker, testAssetId);

      // Verify order book is populated
      const orderBookBefore = await TestHelpers.getOrderBook(testMarketId);
      TestHelpers.verifyOrderBookStructure(orderBookBefore, 3, 3);
      TestHelpers.verifyOrderBookPriceOrdering(orderBookBefore, [50000, 49500, 49000], [51000, 51500, 52000]);

      // Store the exact order book state for comparison
      const bidsBefore = JSON.parse(JSON.stringify(orderBookBefore.bids));
      const asksBefore = JSON.parse(JSON.stringify(orderBookBefore.asks));

      // Clear Redis cache
      await orderService.clearAllRedisData();

      // Verify order book is empty in Redis (cache cleared)
      const orderBookAfterClear = await TestHelpers.getOrderBook(testMarketId);
      expect(orderBookAfterClear.bids).toHaveLength(0);
      expect(orderBookAfterClear.asks).toHaveLength(0);

      // Reinitialize cache from database
      await orderService.restoreOrderBookForMarket(testMarketId);

      // Verify order book is restored correctly
      const orderBookAfterRestore = await TestHelpers.getOrderBook(testMarketId);
      TestHelpers.verifyOrderBookStructure(orderBookAfterRestore, 3, 3);
      TestHelpers.verifyOrderBookPriceOrdering(orderBookAfterRestore, [50000, 49500, 49000], [51000, 51500, 52000]);

      // Verify exact order details match
      expect(orderBookAfterRestore.bids).toHaveLength(bidsBefore.length);
      expect(orderBookAfterRestore.asks).toHaveLength(asksBefore.length);

      // Verify each bid order matches
      for (let i = 0; i < bidsBefore.length; i++) {
        expect(orderBookAfterRestore.bids[i].price).toBe(bidsBefore[i].price);
        expect(orderBookAfterRestore.bids[i].quantity).toBeCloseTo(bidsBefore[i].quantity, 0.0001);
        expect(orderBookAfterRestore.bids[i].side).toBe(bidsBefore[i].side);
        expect(orderBookAfterRestore.bids[i].userId).toBe(bidsBefore[i].userId);
      }

      // Verify each ask order matches
      for (let i = 0; i < asksBefore.length; i++) {
        expect(orderBookAfterRestore.asks[i].price).toBe(asksBefore[i].price);
        expect(orderBookAfterRestore.asks[i].quantity).toBeCloseTo(asksBefore[i].quantity, 0.0001);
        expect(orderBookAfterRestore.asks[i].side).toBe(asksBefore[i].side);
        expect(orderBookAfterRestore.asks[i].userId).toBe(asksBefore[i].userId);
      }
    });

    it("should restore order book with partial fills correctly", async () => {
      const orderService = moduleFixture.get<OrderService>(OrderService);
      const tracker = new UserAssetStateTracker();
      await tracker.registerUserFromCurrentState(app, askerUserId);
      await tracker.registerUserFromCurrentState(app, bidderUserId);

      // Create base asset holdings for ask order
      await TestHelpers.ensureMinimumBaseAsset(askerUserId, testAssetId, 1.2, tracker);
      await TestHelpers.ensureMinimumQuoteAsset(bidderUserId, usdAssetId, 51000 + 10000, tracker);

      // Place ask order
      await TestHelpers.placeOrder(testMarketId, {
        side: "ask",
        price: 51000,
        quantity: 1.2,
        userId: askerUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      // Place matching bid order (partial fill - 1.0 out of 1.2)
      await TestHelpers.placeOrder(testMarketId, {
        side: "bid",
        price: 51000,
        quantity: 1.0,
        userId: bidderUserId,
        quoteAssetId: usdAssetId,
      }).expect(201);

      // Verify order book has the partially filled ask order
      const orderBookBefore = await TestHelpers.getOrderBook(testMarketId);
      expect(orderBookBefore.asks).toHaveLength(1);
      expect(orderBookBefore.asks[0].quantity).toBeCloseTo(0.2, 10); // 1.2 - 1.0 = 0.2

      // Store the exact state
      const askBefore = JSON.parse(JSON.stringify(orderBookBefore.asks[0]));

      // Clear Redis cache
      await orderService.clearAllRedisData();

      // Reinitialize cache from database
      await orderService.restoreOrderBookForMarket(testMarketId);

      // Verify the partially filled order is restored correctly
      const orderBookAfterRestore = await TestHelpers.getOrderBook(testMarketId);
      expect(orderBookAfterRestore.asks).toHaveLength(1);
      expect(orderBookAfterRestore.asks[0].price).toBe(askBefore.price);
      expect(orderBookAfterRestore.asks[0].quantity).toBeCloseTo(askBefore.quantity, 0.0001);
      expect(orderBookAfterRestore.asks[0].side).toBe(askBefore.side);
      expect(orderBookAfterRestore.asks[0].userId).toBe(askBefore.userId);
    });
  });
});
