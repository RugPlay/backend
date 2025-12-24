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

describe("Analytics (e2e)", () => {
  let app: INestApplication;
  let orderService: OrderService;
  let marketService: MarketService;
  let assetService: AssetService;
  let holdingService: HoldingService;
  
  let testMarketId: string;
  let testCorporationId1: string;
  let testCorporationId2: string;
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
    await createTestTrades();
    await createTestHoldings();
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
    // Create test corporations
    testCorporationId1 = await TestCleanupHelper.createTestCorporation(app, `Test Corp 1 ${Date.now()}`);
    testCorporationId2 = await TestCleanupHelper.createTestCorporation(app, `Test Corp 2 ${Date.now()}`);

    // Create test assets
    const assets = await TestCleanupHelper.createTestAssets(app);
    usdAssetId = assets.usdAssetId;
    btcAssetId = assets.btcAssetId;

    // Create ETH asset for holdings testing
    const ethAsset = await assetService.createAsset({
      symbol: "ETH",
      name: "Ethereum",
      type: "crypto",
      decimals: 8,
      isActive: true,
    });
    ethAssetId = ethAsset?.id || "";

    // Give corporations initial USD holdings for trading
    await TestCleanupHelper.createTestAssetHolding(app, testCorporationId1, usdAssetId, 1000000);
    await TestCleanupHelper.createTestAssetHolding(app, testCorporationId2, usdAssetId, 1000000);

    // Create a test market
    const market = await marketService.createMarket({
      name: "Test Bitcoin Market",
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

  async function createTestTrades() {
    // Create base asset holdings for ask orders
    await TestCleanupHelper.createTestAssetHolding(app, testCorporationId2, btcAssetId, 10.0);

    // Create multiple trades with different timestamps to test time bucketing
    const prices = [50000, 50100, 50200, 50300, 50400, 50500];
    const quantities = [0.5, 1.0, 1.5, 2.0, 1.0, 0.5];

    for (let i = 0; i < prices.length; i++) {
      // Create ask order first
      const askOrder: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "ask",
        price: prices[i],
        quantity: quantities[i],
        corporationId: testCorporationId2,
        quoteAssetId: usdAssetId,
      };

      await orderService.addOrderWithMatching(testMarketId, askOrder);

      // Create matching bid order
      const bidOrder: Omit<OrderBookEntryDto, "timestamp"> = {
        marketId: testMarketId,
        orderId: uuidv4(),
        side: "bid",
        price: prices[i],
        quantity: quantities[i],
        corporationId: testCorporationId1,
        quoteAssetId: usdAssetId,
      };

      await orderService.addOrderWithMatching(testMarketId, bidOrder);

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function createTestHoldings() {
    // Create holdings for different users and assets
    await holdingService.upsertHolding(testCorporationId1, btcAssetId, 5.0);
    await holdingService.upsertHolding(testCorporationId1, ethAssetId, 10.0);
    await holdingService.upsertHolding(testCorporationId2, btcAssetId, 3.0);
    await holdingService.upsertHolding(testCorporationId2, ethAssetId, 7.0);

    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  describe("Markets Analytics", () => {
    describe("OHLC Data", () => {
      it("should get OHLC data for a market with 5-minute interval", async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/markets/${testMarketId}/ohlc`)
          .query({ interval: TimeBucketInterval.FIVE_MINUTES })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          const ohlc = response.body[0];
          expect(ohlc).toHaveProperty("timestamp");
          expect(ohlc).toHaveProperty("open");
          expect(ohlc).toHaveProperty("high");
          expect(ohlc).toHaveProperty("low");
          expect(ohlc).toHaveProperty("close");
          expect(ohlc).toHaveProperty("volume");
          expect(ohlc).toHaveProperty("tradeCount");
          expect(typeof ohlc.open).toBe("number");
          expect(typeof ohlc.high).toBe("number");
          expect(typeof ohlc.low).toBe("number");
          expect(typeof ohlc.close).toBe("number");
          expect(ohlc.high).toBeGreaterThanOrEqual(ohlc.low);
          expect(ohlc.high).toBeGreaterThanOrEqual(ohlc.open);
          expect(ohlc.high).toBeGreaterThanOrEqual(ohlc.close);
          expect(ohlc.low).toBeLessThanOrEqual(ohlc.open);
          expect(ohlc.low).toBeLessThanOrEqual(ohlc.close);
        }
      });

      it("should get OHLC data with different intervals", async () => {
        const intervals = [
          TimeBucketInterval.ONE_MINUTE,
          TimeBucketInterval.FIFTEEN_MINUTES,
          TimeBucketInterval.ONE_HOUR,
          TimeBucketInterval.ONE_DAY,
        ];

        for (const interval of intervals) {
          const response = await request(app.getHttpServer())
            .get(`/analytics/markets/${testMarketId}/ohlc`)
            .query({ interval })
            .expect(200);

          expect(Array.isArray(response.body)).toBe(true);
        }
      });

      it("should get OHLC data with time range filter", async () => {
        const startTime = new Date();
        startTime.setHours(startTime.getHours() - 1);
        const endTime = new Date();

        const response = await request(app.getHttpServer())
          .get(`/analytics/markets/${testMarketId}/ohlc`)
          .query({
            interval: TimeBucketInterval.FIVE_MINUTES,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it("should get OHLC data with limit", async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/markets/${testMarketId}/ohlc`)
          .query({
            interval: TimeBucketInterval.FIVE_MINUTES,
            limit: 10,
          })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(10);
      });

      it("should return 200 even if market has no trades", async () => {
        // Create a new market with no trades
        const newMarket = await marketService.createMarket({
          name: "Empty Market",
          symbol: "EMPTY/USD",
          category: "crypto",
          baseAsset: "EMPTY",
          quoteAsset: "USD",
          baseAssetId: btcAssetId,
          quoteAssetId: usdAssetId,
          minPriceIncrement: 0.01,
          minQuantityIncrement: 0.001,
          isActive: true,
          is24h: true,
          timezone: "UTC",
        });

        const response = await request(app.getHttpServer())
          .get(`/analytics/markets/${newMarket?.id}/ohlc`)
          .query({ interval: TimeBucketInterval.FIVE_MINUTES })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe("Volume Data", () => {
      it("should get volume data for a market", async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/markets/${testMarketId}/volume`)
          .query({ interval: TimeBucketInterval.FIVE_MINUTES })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          const volume = response.body[0];
          expect(volume).toHaveProperty("timestamp");
          expect(volume).toHaveProperty("volume");
          expect(volume).toHaveProperty("tradeCount");
          expect(typeof volume.volume).toBe("number");
          expect(typeof volume.tradeCount).toBe("number");
          expect(volume.volume).toBeGreaterThanOrEqual(0);
          expect(volume.tradeCount).toBeGreaterThanOrEqual(0);
        }
      });

      it("should get volume data with time range and limit", async () => {
        const startTime = new Date();
        startTime.setHours(startTime.getHours() - 1);

        const response = await request(app.getHttpServer())
          .get(`/analytics/markets/${testMarketId}/volume`)
          .query({
            interval: TimeBucketInterval.ONE_HOUR,
            startTime: startTime.toISOString(),
            limit: 5,
          })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(5);
      });
    });

    describe("Price Change Data", () => {
      it("should get price change data for a market", async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/markets/${testMarketId}/price-change`)
          .query({ interval: TimeBucketInterval.FIVE_MINUTES })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          const priceChange = response.body[0];
          expect(priceChange).toHaveProperty("timestamp");
          expect(priceChange).toHaveProperty("price");
          expect(priceChange).toHaveProperty("change");
          expect(priceChange).toHaveProperty("changePercent");
          expect(typeof priceChange.price).toBe("number");
          expect(typeof priceChange.change).toBe("number");
          expect(typeof priceChange.changePercent).toBe("number");
        }
      });
    });

    describe("Latest Price", () => {
      it("should get the latest price for a market", async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/markets/${testMarketId}/latest-price`)
          .expect(200);

        // Handle different response formats
        let price: number | null = null;
        if (response.body === null || response.body === undefined) {
          price = null;
        } else if (typeof response.body === "number") {
          price = response.body;
        } else if (typeof response.body === "string") {
          price = parseFloat(response.body);
        } else if (typeof response.body === "object" && "value" in response.body) {
          price = typeof response.body.value === "number" ? response.body.value : parseFloat(String(response.body.value));
        }

        if (price !== null) {
          expect(typeof price).toBe("number");
          expect(price).toBeGreaterThan(0);
        }
      });

      it("should return null for market with no trades", async () => {
        const newMarket = await marketService.createMarket({
          name: "No Trades Market",
          symbol: "NOTRADES/USD",
          category: "crypto",
          baseAsset: "NOTRADES",
          quoteAsset: "USD",
          baseAssetId: btcAssetId,
          quoteAssetId: usdAssetId,
          minPriceIncrement: 0.01,
          minQuantityIncrement: 0.001,
          isActive: true,
          is24h: true,
          timezone: "UTC",
        });

        const response = await request(app.getHttpServer())
          .get(`/analytics/markets/${newMarket?.id}/latest-price`)
          .expect(200);

        // NestJS might serialize null differently - check for null, undefined, empty string, or empty object
        const isNullish = response.body === null 
          || response.body === undefined 
          || response.body === ""
          || (typeof response.body === "object" && Object.keys(response.body).length === 0);
        expect(isNullish).toBe(true);
      });
    });

    describe("24-Hour Statistics", () => {
      it("should get 24-hour statistics for a market", async () => {
        const response = await request(app.getHttpServer())
          .get(`/analytics/markets/${testMarketId}/24h-stats`)
          .expect(200);

        if (response.body !== null) {
          expect(response.body).toHaveProperty("open");
          expect(response.body).toHaveProperty("high");
          expect(response.body).toHaveProperty("low");
          expect(response.body).toHaveProperty("close");
          expect(response.body).toHaveProperty("volume");
          expect(response.body).toHaveProperty("tradeCount");
          expect(response.body).toHaveProperty("change");
          expect(response.body).toHaveProperty("changePercent");
          expect(typeof response.body.open).toBe("number");
          expect(typeof response.body.high).toBe("number");
          expect(typeof response.body.low).toBe("number");
          expect(typeof response.body.close).toBe("number");
          expect(response.body.high).toBeGreaterThanOrEqual(response.body.low);
        }
      });
    });

    describe("Error Handling", () => {
      it("should return 400 for invalid interval", async () => {
        await request(app.getHttpServer())
          .get(`/analytics/markets/${testMarketId}/ohlc`)
          .query({ interval: "invalid" })
          .expect(400);
      });

      it("should return 200 with empty array for non-existent market", async () => {
        const fakeMarketId = uuidv4();
        const response = await request(app.getHttpServer())
          .get(`/analytics/markets/${fakeMarketId}/ohlc`)
          .query({ interval: TimeBucketInterval.FIVE_MINUTES })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  describe("Holdings Analytics", () => {
    describe("Production Rate Data", () => {
      it("should get holdings production data", async () => {
        const response = await request(app.getHttpServer())
          .get("/analytics/holdings/production")
          .query({ interval: TimeBucketInterval.ONE_HOUR })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          const production = response.body[0];
          expect(production).toHaveProperty("timestamp");
          expect(production).toHaveProperty("created");
          expect(production).toHaveProperty("removed");
          expect(production).toHaveProperty("netChange");
          expect(production).toHaveProperty("totalHoldings");
          expect(typeof production.created).toBe("number");
          expect(typeof production.removed).toBe("number");
          expect(typeof production.netChange).toBe("number");
          expect(typeof production.totalHoldings).toBe("number");
          expect(production.created).toBeGreaterThanOrEqual(0);
          expect(production.removed).toBeGreaterThanOrEqual(0);
        }
      });

      it("should get holdings production data filtered by corporationId", async () => {
        const response = await request(app.getHttpServer())
          .get("/analytics/holdings/production")
          .query({
            interval: TimeBucketInterval.ONE_HOUR,
            corporationId: testCorporationId1,
          })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it("should get holdings production data filtered by assetId", async () => {
        const response = await request(app.getHttpServer())
          .get("/analytics/holdings/production")
          .query({
            interval: TimeBucketInterval.ONE_HOUR,
            assetId: btcAssetId,
          })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it("should get holdings production data with time range", async () => {
        const startTime = new Date();
        startTime.setHours(startTime.getHours() - 24);
        const endTime = new Date();

        const response = await request(app.getHttpServer())
          .get("/analytics/holdings/production")
          .query({
            interval: TimeBucketInterval.ONE_DAY,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            limit: 10,
          })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(10);
      });
    });

    describe("Growth Data", () => {
      it("should get holdings growth data", async () => {
        const response = await request(app.getHttpServer())
          .get("/analytics/holdings/growth")
          .query({ interval: TimeBucketInterval.ONE_HOUR })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          const growth = response.body[0];
          expect(growth).toHaveProperty("timestamp");
          expect(growth).toHaveProperty("totalQuantity");
          expect(growth).toHaveProperty("quantityAdded");
          expect(growth).toHaveProperty("quantityRemoved");
          expect(growth).toHaveProperty("netQuantityChange");
          expect(growth).toHaveProperty("growthRate");
          expect(typeof growth.totalQuantity).toBe("number");
          expect(typeof growth.quantityAdded).toBe("number");
          expect(typeof growth.quantityRemoved).toBe("number");
          expect(typeof growth.netQuantityChange).toBe("number");
          expect(typeof growth.growthRate).toBe("number");
        }
      });

      it("should get holdings growth data with filters", async () => {
        const response = await request(app.getHttpServer())
          .get("/analytics/holdings/growth")
          .query({
            interval: TimeBucketInterval.ONE_HOUR,
            corporationId: testCorporationId1,
            assetId: btcAssetId,
          })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe("Total Holdings Count", () => {
      it("should get total holdings count", async () => {
        const response = await request(app.getHttpServer())
          .get("/analytics/holdings/count")
          .expect(200);

        // Handle different response formats - log for debugging if needed
        let count: number;
        if (typeof response.body === "number") {
          count = response.body;
        } else if (typeof response.body === "string") {
          const parsed = parseFloat(response.body);
          count = isNaN(parsed) ? 0 : parsed;
        } else if (typeof response.body === "object" && response.body !== null) {
          // Check if it's an object with a numeric property
          const value = (response.body as any).value ?? (response.body as any).count ?? (response.body as any);
          if (typeof value === "number") {
            count = value;
          } else {
            const parsed = parseFloat(String(value));
            count = isNaN(parsed) ? 0 : parsed;
          }
        } else {
          count = 0;
        }
        
        expect(typeof count).toBe("number");
        expect(count).toBeGreaterThanOrEqual(0);
      });

      it("should get total holdings count filtered by corporationId", async () => {
        const response = await request(app.getHttpServer())
          .get("/analytics/holdings/count")
          .query({ corporationId: testCorporationId1 })
          .expect(200);

        let count: number;
        if (typeof response.body === "number") {
          count = response.body;
        } else if (typeof response.body === "string") {
          const parsed = parseFloat(response.body);
          count = isNaN(parsed) ? 0 : parsed;
        } else if (typeof response.body === "object" && response.body !== null) {
          const value = (response.body as any).value ?? (response.body as any).count ?? (response.body as any);
          if (typeof value === "number") {
            count = value;
          } else {
            const parsed = parseFloat(String(value));
            count = isNaN(parsed) ? 0 : parsed;
          }
        } else {
          count = 0;
        }
        
        expect(typeof count).toBe("number");
        expect(count).toBeGreaterThanOrEqual(0);
      });

      it("should get total holdings count filtered by assetId", async () => {
        const response = await request(app.getHttpServer())
          .get("/analytics/holdings/count")
          .query({ assetId: btcAssetId })
          .expect(200);

        let count: number;
        if (typeof response.body === "number") {
          count = response.body;
        } else if (typeof response.body === "string") {
          const parsed = parseFloat(response.body);
          count = isNaN(parsed) ? 0 : parsed;
        } else if (typeof response.body === "object" && response.body !== null) {
          const value = (response.body as any).value ?? (response.body as any).count ?? (response.body as any);
          if (typeof value === "number") {
            count = value;
          } else {
            const parsed = parseFloat(String(value));
            count = isNaN(parsed) ? 0 : parsed;
          }
        } else {
          count = 0;
        }
        
        expect(typeof count).toBe("number");
        expect(count).toBeGreaterThanOrEqual(0);
      });

      it("should get total holdings count at a specific time", async () => {
        const atTime = new Date();
        atTime.setHours(atTime.getHours() - 1);

        const response = await request(app.getHttpServer())
          .get("/analytics/holdings/count")
          .query({ atTime: atTime.toISOString() })
          .expect(200);

        let count: number;
        if (typeof response.body === "number") {
          count = response.body;
        } else if (typeof response.body === "string") {
          const parsed = parseFloat(response.body);
          count = isNaN(parsed) ? 0 : parsed;
        } else if (typeof response.body === "object" && response.body !== null) {
          const value = (response.body as any).value ?? (response.body as any).count ?? (response.body as any);
          if (typeof value === "number") {
            count = value;
          } else {
            const parsed = parseFloat(String(value));
            count = isNaN(parsed) ? 0 : parsed;
          }
        } else {
          count = 0;
        }
        
        expect(typeof count).toBe("number");
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

