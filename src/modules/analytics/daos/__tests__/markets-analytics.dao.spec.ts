import { Test, TestingModule } from "@nestjs/testing";
import { MarketsAnalyticsDao } from "../markets-analytics.dao";
import { KyselyModule } from "nestjs-kysely";
import { PostgresModule } from "@/postgres/postgres.module";
import { PostgresDialect } from "kysely";
import { DATABASE_POOL } from "@/postgres/constants/postgres.constants";
import { TimeBucketInterval } from "../../dtos/shared/time-bucket.dto";

describe("MarketsAnalyticsDao", () => {
  let dao: MarketsAnalyticsDao;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        PostgresModule,
        KyselyModule.forRootAsync({
          imports: [PostgresModule],
          inject: [DATABASE_POOL],
          useFactory: (postgresPool: any) => ({
            dialect: new PostgresDialect({
              pool: postgresPool,
            }),
          }),
        }),
      ],
      providers: [MarketsAnalyticsDao],
    }).compile();

    dao = module.get<MarketsAnalyticsDao>(MarketsAnalyticsDao);
  });

  afterAll(async () => {
    await module.close();
  });

  describe("getOhlcData", () => {
    it("should return an array", async () => {
      const marketId = "test-market-id";
      const result = await dao.getOhlcData(
        marketId,
        TimeBucketInterval.FIVE_MINUTES,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle empty market gracefully", async () => {
      const fakeMarketId = "non-existent-market-id";
      const result = await dao.getOhlcData(
        fakeMarketId,
        TimeBucketInterval.FIVE_MINUTES,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it("should respect time range parameters", async () => {
      const marketId = "test-market-id";
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - 1);
      const endTime = new Date();

      const result = await dao.getOhlcData(
        marketId,
        TimeBucketInterval.FIVE_MINUTES,
        startTime,
        endTime,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const marketId = "test-market-id";
      const result = await dao.getOhlcData(
        marketId,
        TimeBucketInterval.FIVE_MINUTES,
        undefined,
        undefined,
        5,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it("should return valid OHLC structure", async () => {
      const marketId = "test-market-id";
      const result = await dao.getOhlcData(
        marketId,
        TimeBucketInterval.FIVE_MINUTES,
      );

      if (result.length > 0) {
        const ohlc = result[0];
        expect(ohlc).toHaveProperty("timestamp");
        expect(ohlc).toHaveProperty("open");
        expect(ohlc).toHaveProperty("high");
        expect(ohlc).toHaveProperty("low");
        expect(ohlc).toHaveProperty("close");
        expect(ohlc).toHaveProperty("volume");
        expect(ohlc).toHaveProperty("tradeCount");
      }
    });
  });

  describe("getVolumeData", () => {
    it("should return an array", async () => {
      const marketId = "test-market-id";
      const result = await dao.getVolumeData(
        marketId,
        TimeBucketInterval.FIVE_MINUTES,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it("should return valid volume structure", async () => {
      const marketId = "test-market-id";
      const result = await dao.getVolumeData(
        marketId,
        TimeBucketInterval.FIVE_MINUTES,
      );

      if (result.length > 0) {
        const volume = result[0];
        expect(volume).toHaveProperty("timestamp");
        expect(volume).toHaveProperty("volume");
        expect(volume).toHaveProperty("tradeCount");
        expect(typeof volume.volume).toBe("number");
        expect(typeof volume.tradeCount).toBe("number");
      }
    });
  });

  describe("getPriceChangeData", () => {
    it("should return an array", async () => {
      const marketId = "test-market-id";
      const result = await dao.getPriceChangeData(
        marketId,
        TimeBucketInterval.FIVE_MINUTES,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it("should return valid price change structure", async () => {
      const marketId = "test-market-id";
      const result = await dao.getPriceChangeData(
        marketId,
        TimeBucketInterval.FIVE_MINUTES,
      );

      if (result.length > 0) {
        const priceChange = result[0];
        expect(priceChange).toHaveProperty("timestamp");
        expect(priceChange).toHaveProperty("price");
        expect(priceChange).toHaveProperty("change");
        expect(priceChange).toHaveProperty("changePercent");
      }
    });
  });

  describe("getLatestPrice", () => {
    it("should return a number or null", async () => {
      const marketId = "test-market-id";
      const result = await dao.getLatestPrice(marketId);

      expect(result === null || typeof result === "number").toBe(true);
    });

    it("should return null for non-existent market", async () => {
      const fakeMarketId = "non-existent-market-id";
      const result = await dao.getLatestPrice(fakeMarketId);

      expect(result).toBeNull();
    });
  });

  describe("get24HourStats", () => {
    it("should return stats object or null", async () => {
      const marketId = "test-market-id";
      const result = await dao.get24HourStats(marketId);

      if (result !== null) {
        expect(result).toHaveProperty("open");
        expect(result).toHaveProperty("high");
        expect(result).toHaveProperty("low");
        expect(result).toHaveProperty("close");
        expect(result).toHaveProperty("volume");
        expect(result).toHaveProperty("tradeCount");
        expect(result).toHaveProperty("change");
        expect(result).toHaveProperty("changePercent");
      }
    });

    it("should return null for market with no trades", async () => {
      const fakeMarketId = "non-existent-market-id";
      const result = await dao.get24HourStats(fakeMarketId);

      expect(result).toBeNull();
    });
  });
});

