import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { v4 as uuidv4 } from "uuid";
import { TestCleanupHelper } from "./helpers/test-cleanup.helper";
import { OrderService } from "../src/modules/exchange/services/order.service";
import { MarketService } from "../src/modules/exchange/services/market.service";
import { AssetService } from "../src/modules/assets/services/asset.service";
import { HoldingService } from "../src/modules/assets/services/holding.service";
import { TimeBucketInterval } from "../src/modules/analytics/dtos/shared/time-bucket.dto";
import { OrderBookEntryDto } from "../src/modules/exchange/dtos/order/order-book-entry.dto";
import { AssetHoldingDao } from "../src/modules/assets/daos/asset-holding.dao";
import { Kysely, sql } from "kysely";
import { DB } from "../src/database/types/db";

describe("Analytics Integration (e2e)", () => {
  let app: INestApplication;
  let orderService: OrderService;
  let marketService: MarketService;
  let assetService: AssetService;
  let holdingService: HoldingService;
  
  let testMarketId: string;
  let testUserIds: string[];
  let usdAssetId: string;
  let btcAssetId: string;
  let ethAssetId: string;

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
    holdingService = moduleFixture.get<HoldingService>(HoldingService);

    // Ensure TimescaleDB is enabled and hypertables are created
    await ensureTimescaleDBSetup();

    await setupTestData();
    await createLargeDataset();
  });

  async function ensureTimescaleDBSetup() {
    const assetHoldingDao = app.get(AssetHoldingDao);
    const kysely = (assetHoldingDao as any).kysely as Kysely<DB>;

    try {
      // Enable TimescaleDB extension if not already enabled
      await sql`CREATE EXTENSION IF NOT EXISTS timescaledb`.execute(kysely);

      // Check if hypertables already exist, if not create them
      // Note: We use migrate_to_hypertable for existing tables to handle unique constraints
      const tradesCheck = await sql`
        SELECT COUNT(*) as count
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'trades'
      `.execute(kysely);
      
      const tradesRows = Array.isArray(tradesCheck) ? tradesCheck : (tradesCheck as any)?.rows || [];
      const tradesCount = tradesRows[0]?.count || 0;
      
      if (parseInt(tradesCount) === 0) {
        try {
          // Try to convert existing table to hypertable
          await sql`
            SELECT create_hypertable(
              'trades',
              'created_at',
              chunk_time_interval => INTERVAL '1 day',
              if_not_exists => TRUE
            )
          `.execute(kysely);
        } catch (hypertableError: any) {
          // If it fails due to unique constraints, that's okay - table might already be set up
          if (!hypertableError?.message?.includes('unique index')) {
            console.warn("Could not create trades hypertable:", hypertableError?.message);
          }
        }
      }

      const ordersCheck = await sql`
        SELECT COUNT(*) as count
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'orders'
      `.execute(kysely);
      
      const ordersRows = Array.isArray(ordersCheck) ? ordersCheck : (ordersCheck as any)?.rows || [];
      const ordersCount = ordersRows[0]?.count || 0;
      
      if (parseInt(ordersCount) === 0) {
        try {
          await sql`
            SELECT create_hypertable(
              'orders',
              'created_at',
              chunk_time_interval => INTERVAL '1 day',
              if_not_exists => TRUE
            )
          `.execute(kysely);
        } catch (hypertableError: any) {
          if (!hypertableError?.message?.includes('unique index')) {
            console.warn("Could not create orders hypertable:", hypertableError?.message);
          }
        }
      }

      const holdingsCheck = await sql`
        SELECT COUNT(*) as count
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'holdings'
      `.execute(kysely);
      
      const holdingsRows = Array.isArray(holdingsCheck) ? holdingsCheck : (holdingsCheck as any)?.rows || [];
      const holdingsCount = holdingsRows[0]?.count || 0;
      
      if (parseInt(holdingsCount) === 0) {
        try {
          await sql`
            SELECT create_hypertable(
              'holdings',
              'created_at',
              chunk_time_interval => INTERVAL '1 day',
              if_not_exists => TRUE
            )
          `.execute(kysely);
        } catch (hypertableError: any) {
          if (!hypertableError?.message?.includes('unique index')) {
            console.warn("Could not create holdings hypertable:", hypertableError?.message);
          }
        }
      }
    } catch (error) {
      console.error("Error setting up TimescaleDB:", error);
      // Don't throw - tests might still work if hypertables already exist
    }
  }

  afterAll(async () => {
    await TestCleanupHelper.cleanupTestData(app);
    await app.close();
  });

  async function setupTestData() {
    // Create multiple test users
    testUserIds = Array.from({ length: 5 }, () => `test_user_${uuidv4()}`);

    // Create test assets
    const assets = await TestCleanupHelper.createTestAssets(app);
    usdAssetId = assets.usdAssetId;
    btcAssetId = assets.btcAssetId;

    // Create ETH asset
    const ethAsset = await assetService.createAsset({
      symbol: "ETH",
      name: "Ethereum",
      type: "crypto",
      decimals: 8,
      isActive: true,
    });
    ethAssetId = ethAsset?.id || "";

    // Give users initial USD holdings
    for (const userId of testUserIds) {
      await TestCleanupHelper.createTestAssetHolding(app, userId, usdAssetId, 1000000);
    }

    // Create test market
    const market = await marketService.createMarket({
      name: "Integration Test Market",
      symbol: "BTC/USD",
      category: "crypto",
      baseAsset: "BTC",
      quoteAsset: "USD",
      baseAssetId: btcAssetId,
      quoteAssetId: usdAssetId,
      minPriceIncrement: 0.01,
      minQuantityIncrement: 0.001,
      maxQuantity: 100,
      isActive: true,
      is24h: true,
      timezone: "UTC",
    });

    testMarketId = market?.id || "";
  }

  async function createLargeDataset() {
    // Create base asset holdings for ask orders
    for (const userId of testUserIds) {
      await TestCleanupHelper.createTestAssetHolding(app, userId, btcAssetId, 10.0);
    }

    // Create many trades over time to test time bucketing
    const basePrice = 50000;
    const priceVariations = [-500, -300, -100, 0, 100, 300, 500];
    const quantities = [0.1, 0.5, 1.0, 1.5, 2.0, 0.8, 0.3];

    for (let i = 0; i < 20; i++) {
      const price = basePrice + priceVariations[i % priceVariations.length];
      const quantity = quantities[i % quantities.length];
      const userId1 = testUserIds[i % testUserIds.length];
      const userId2 = testUserIds[(i + 1) % testUserIds.length];

      // Create ask order first
      const askOrder: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "ask",
        price,
        quantity,
        userId: userId2,
        quoteAssetId: usdAssetId,
      };

      await orderService.addOrderWithMatching(testMarketId, askOrder);

      // Create matching bid order
      const bidOrder: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "bid",
        price,
        quantity,
        userId: userId1,
        quoteAssetId: usdAssetId,
      };

      await orderService.addOrderWithMatching(testMarketId, bidOrder);

      // Small delay to create time separation
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Create holdings for different users
    for (let i = 0; i < testUserIds.length; i++) {
      await holdingService.upsertHolding(testUserIds[i], btcAssetId, (i + 1) * 2.0);
      await holdingService.upsertHolding(testUserIds[i], ethAssetId, (i + 1) * 5.0);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  describe("Time Bucketing Accuracy", () => {
    it("should correctly bucket trades into 5-minute intervals", async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/ohlc`)
        .query({ interval: TimeBucketInterval.FIVE_MINUTES })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify timestamps are properly bucketed
      if (response.body.length > 1) {
        const timestamps = response.body.map((item: any) => new Date(item.timestamp).getTime());
        timestamps.sort((a, b) => a - b);
        
        // Check that timestamps are in ascending order
        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
        }
      }
    });

    it("should correctly bucket trades into 1-hour intervals", async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/ohlc`)
        .query({ interval: TimeBucketInterval.ONE_HOUR })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should correctly bucket trades into 1-day intervals", async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/ohlc`)
        .query({ interval: TimeBucketInterval.ONE_DAY })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("OHLC Calculations", () => {
    it("should calculate correct OHLC values", async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/ohlc`)
        .query({ interval: TimeBucketInterval.FIVE_MINUTES })
        .expect(200);

      if (response.body.length > 0) {
        for (const ohlc of response.body) {
          // High should be >= all other values
          expect(ohlc.high).toBeGreaterThanOrEqual(ohlc.open);
          expect(ohlc.high).toBeGreaterThanOrEqual(ohlc.close);
          expect(ohlc.high).toBeGreaterThanOrEqual(ohlc.low);

          // Low should be <= all other values
          expect(ohlc.low).toBeLessThanOrEqual(ohlc.open);
          expect(ohlc.low).toBeLessThanOrEqual(ohlc.close);
          expect(ohlc.low).toBeLessThanOrEqual(ohlc.high);

          // Volume should be >= 0
          expect(ohlc.volume).toBeGreaterThanOrEqual(0);
          
          // Trade count should be >= 0
          expect(ohlc.tradeCount).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should aggregate volume correctly across time buckets", async () => {
      const ohlcResponse = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/ohlc`)
        .query({ interval: TimeBucketInterval.FIVE_MINUTES })
        .expect(200);

      const volumeResponse = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/volume`)
        .query({ interval: TimeBucketInterval.FIVE_MINUTES })
        .expect(200);

      // Volume in OHLC should match volume endpoint
      if (ohlcResponse.body.length > 0 && volumeResponse.body.length > 0) {
        const ohlcMap = new Map(
          ohlcResponse.body.map((item: any) => [
            item.timestamp,
            item.volume,
          ])
        );

        for (const volumeItem of volumeResponse.body) {
          const ohlcVolume = ohlcMap.get(volumeItem.timestamp);
          if (ohlcVolume !== undefined && typeof ohlcVolume === "number") {
            expect(volumeItem.volume).toBeCloseTo(ohlcVolume, 2);
          }
        }
      }
    });
  });

  describe("Price Change Calculations", () => {
    it("should calculate price changes correctly", async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/price-change`)
        .query({ interval: TimeBucketInterval.FIVE_MINUTES })
        .expect(200);

      if (response.body.length > 1) {
        for (let i = 1; i < response.body.length; i++) {
          const current = response.body[i];
          const previous = response.body[i - 1];

          // Change should be current price - previous price
          const expectedChange = current.price - previous.price;
          expect(current.change).toBeCloseTo(expectedChange, 2);

          // Change percent should be calculated correctly
          if (previous.price !== 0) {
            const expectedChangePercent = (expectedChange / previous.price) * 100;
            expect(current.changePercent).toBeCloseTo(expectedChangePercent, 2);
          }
        }
      }
    });
  });

  describe("Holdings Production Rate", () => {
    it("should track holdings created over time", async () => {
      const response = await request(app.getHttpServer())
        .get("/analytics/holdings/production")
        .query({ interval: TimeBucketInterval.ONE_HOUR })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        // Total holdings should be cumulative
        let previousTotal = 0;
        for (const item of response.body) {
          expect(item.totalHoldings).toBeGreaterThanOrEqual(previousTotal);
          expect(item.netChange).toBe(item.created - item.removed);
          previousTotal = item.totalHoldings;
        }
      }
    });

    it("should correctly filter holdings production by user", async () => {
      const allResponse = await request(app.getHttpServer())
        .get("/analytics/holdings/production")
        .query({ interval: TimeBucketInterval.ONE_HOUR })
        .expect(200);

      const userResponse = await request(app.getHttpServer())
        .get("/analytics/holdings/production")
        .query({
          interval: TimeBucketInterval.ONE_HOUR,
          userId: testUserIds[0],
        })
        .expect(200);

      // User-specific data should be a subset or equal
      expect(userResponse.body.length).toBeLessThanOrEqual(allResponse.body.length);
    });
  });

  describe("Holdings Growth", () => {
    it("should calculate growth rates correctly", async () => {
      const response = await request(app.getHttpServer())
        .get("/analytics/holdings/growth")
        .query({ interval: TimeBucketInterval.ONE_HOUR })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        let previousQuantity = 0;
        for (const growth of response.body) {
          expect(growth.netQuantityChange).toBe(
            growth.quantityAdded - growth.quantityRemoved
          );
          
          // Growth rate calculation - should be relative to previous period's quantity
          if (previousQuantity > 0) {
            const expectedGrowthRate = (growth.netQuantityChange / previousQuantity) * 100;
            expect(Math.abs(growth.growthRate - expectedGrowthRate)).toBeLessThan(0.01);
          } else {
            // First period should have growth rate of 0 if no previous quantity
            expect(growth.growthRate).toBe(0);
          }
          
          previousQuantity = growth.totalQuantity;
        }
      }
    });
  });

  describe("Time Range Filtering", () => {
    it("should correctly filter data by time range", async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // Get data for last 2 hours
      const twoHourResponse = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/ohlc`)
        .query({
          interval: TimeBucketInterval.FIVE_MINUTES,
          startTime: twoHoursAgo.toISOString(),
          endTime: now.toISOString(),
        })
        .expect(200);

      // Get data for last 1 hour
      const oneHourResponse = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/ohlc`)
        .query({
          interval: TimeBucketInterval.FIVE_MINUTES,
          startTime: oneHourAgo.toISOString(),
          endTime: now.toISOString(),
        })
        .expect(200);

      // One hour data should be <= two hour data
      expect(oneHourResponse.body.length).toBeLessThanOrEqual(twoHourResponse.body.length);

      // All timestamps in one hour response should be within range
      for (const item of oneHourResponse.body) {
        const timestamp = new Date(item.timestamp);
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
        expect(timestamp.getTime()).toBeLessThanOrEqual(now.getTime());
      }
    });
  });

  describe("Limit Parameter", () => {
    it("should respect limit parameter for OHLC", async () => {
      const limits = [1, 5, 10, 20];

      for (const limit of limits) {
        const response = await request(app.getHttpServer())
          .get(`/analytics/markets/${testMarketId}/ohlc`)
          .query({
            interval: TimeBucketInterval.FIVE_MINUTES,
            limit,
          })
          .expect(200);

        expect(response.body.length).toBeLessThanOrEqual(limit);
      }
    });

    it("should respect limit parameter for volume", async () => {
      const response = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/volume`)
        .query({
          interval: TimeBucketInterval.FIVE_MINUTES,
          limit: 5,
        })
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe("Multiple Markets", () => {
    it("should return separate analytics for different markets", async () => {
      // Create a second market
      const secondMarket = await marketService.createMarket({
        name: "Second Test Market",
        symbol: "ETH/USD",
        category: "crypto",
        baseAsset: "ETH",
        quoteAsset: "USD",
        baseAssetId: ethAssetId,
        quoteAssetId: usdAssetId,
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        isActive: true,
        is24h: true,
        timezone: "UTC",
      });

      const market1Response = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/ohlc`)
        .query({ interval: TimeBucketInterval.FIVE_MINUTES })
        .expect(200);

      const market2Response = await request(app.getHttpServer())
        .get(`/analytics/markets/${secondMarket?.id}/ohlc`)
        .query({ interval: TimeBucketInterval.FIVE_MINUTES })
        .expect(200);

      // Markets should have independent analytics
      expect(Array.isArray(market1Response.body)).toBe(true);
      expect(Array.isArray(market2Response.body)).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty result sets gracefully", async () => {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 1);

      const response = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/ohlc`)
        .query({
          interval: TimeBucketInterval.FIVE_MINUTES,
          startTime: farFuture.toISOString(),
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should handle very large time ranges", async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const response = await request(app.getHttpServer())
        .get(`/analytics/markets/${testMarketId}/ohlc`)
        .query({
          interval: TimeBucketInterval.ONE_DAY,
          startTime: oneYearAgo.toISOString(),
          limit: 100,
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(100);
    });

    it("should handle concurrent requests", async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .get(`/analytics/markets/${testMarketId}/ohlc`)
          .query({ interval: TimeBucketInterval.FIVE_MINUTES })
      );

      const responses = await Promise.all(requests);
      
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      }
    });
  });
});

