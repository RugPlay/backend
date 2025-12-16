import { Test, TestingModule } from "@nestjs/testing";
import { HoldingsAnalyticsDao } from "../holdings-analytics.dao";
import { KyselyModule } from "nestjs-kysely";
import { PostgresModule } from "@/postgres/postgres.module";
import { PostgresDialect } from "kysely";
import { DATABASE_POOL } from "@/postgres/constants/postgres.constants";
import { TimeBucketInterval } from "../../dtos/shared/time-bucket.dto";
import { HoldingsProductionQueryDto } from "../../dtos/holdings/holdings-production.dto";

describe("HoldingsAnalyticsDao", () => {
  let dao: HoldingsAnalyticsDao;
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
      providers: [HoldingsAnalyticsDao],
    }).compile();

    dao = module.get<HoldingsAnalyticsDao>(HoldingsAnalyticsDao);
  });

  afterAll(async () => {
    await module.close();
  });

  describe("getHoldingsProductionData", () => {
    it("should return an array", async () => {
      const query: HoldingsProductionQueryDto = {
        interval: TimeBucketInterval.ONE_HOUR,
      };

      const result = await dao.getHoldingsProductionData(query);

      expect(Array.isArray(result)).toBe(true);
    });

    it("should return valid production structure", async () => {
      const query: HoldingsProductionQueryDto = {
        interval: TimeBucketInterval.ONE_HOUR,
      };

      const result = await dao.getHoldingsProductionData(query);

      if (result.length > 0) {
        const production = result[0];
        expect(production).toHaveProperty("timestamp");
        expect(production).toHaveProperty("created");
        expect(production).toHaveProperty("removed");
        expect(production).toHaveProperty("netChange");
        expect(production).toHaveProperty("totalHoldings");
        expect(typeof production.created).toBe("number");
        expect(typeof production.removed).toBe("number");
        expect(typeof production.netChange).toBe("number");
        expect(typeof production.totalHoldings).toBe("number");
      }
    });

    it("should filter by userId", async () => {
      const query: HoldingsProductionQueryDto = {
        interval: TimeBucketInterval.ONE_HOUR,
        userId: "test-user-id",
      };

      const result = await dao.getHoldingsProductionData(query);

      expect(Array.isArray(result)).toBe(true);
    });

    it("should filter by assetId", async () => {
      const query: HoldingsProductionQueryDto = {
        interval: TimeBucketInterval.ONE_HOUR,
        assetId: "test-asset-id",
      };

      const result = await dao.getHoldingsProductionData(query);

      expect(Array.isArray(result)).toBe(true);
    });

    it("should respect time range", async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - 24);
      const endTime = new Date();

      const query: HoldingsProductionQueryDto = {
        interval: TimeBucketInterval.ONE_DAY,
        startTime,
        endTime,
      };

      const result = await dao.getHoldingsProductionData(query);

      expect(Array.isArray(result)).toBe(true);
    });

    it("should respect limit", async () => {
      const query: HoldingsProductionQueryDto = {
        interval: TimeBucketInterval.ONE_HOUR,
        limit: 10,
      };

      const result = await dao.getHoldingsProductionData(query);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe("getHoldingsGrowthData", () => {
    it("should return an array", async () => {
      const result = await dao.getHoldingsGrowthData(TimeBucketInterval.ONE_HOUR);

      expect(Array.isArray(result)).toBe(true);
    });

    it("should return valid growth structure", async () => {
      const result = await dao.getHoldingsGrowthData(TimeBucketInterval.ONE_HOUR);

      if (result.length > 0) {
        const growth = result[0];
        expect(growth).toHaveProperty("timestamp");
        expect(growth).toHaveProperty("totalQuantity");
        expect(growth).toHaveProperty("quantityAdded");
        expect(growth).toHaveProperty("quantityRemoved");
        expect(growth).toHaveProperty("netQuantityChange");
        expect(growth).toHaveProperty("growthRate");
      }
    });

    it("should filter by userId", async () => {
      const result = await dao.getHoldingsGrowthData(
        TimeBucketInterval.ONE_HOUR,
        "test-user-id",
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it("should filter by assetId", async () => {
      const result = await dao.getHoldingsGrowthData(
        TimeBucketInterval.ONE_HOUR,
        undefined,
        "test-asset-id",
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getTotalHoldingsCount", () => {
    it("should return a number", async () => {
      const result = await dao.getTotalHoldingsCount();

      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("should filter by userId", async () => {
      const result = await dao.getTotalHoldingsCount("test-user-id");

      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("should filter by assetId", async () => {
      const result = await dao.getTotalHoldingsCount(undefined, "test-asset-id");

      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("should filter by time", async () => {
      const atTime = new Date();
      const result = await dao.getTotalHoldingsCount(undefined, undefined, atTime);

      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});

