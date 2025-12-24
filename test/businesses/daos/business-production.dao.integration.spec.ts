import { Test, TestingModule } from "@nestjs/testing";
import { BusinessProductionDao } from "../../../src/modules/businesses/daos/business-production.dao";
import { BusinessDao } from "../../../src/modules/businesses/daos/business.dao";
import { BusinessInputDao } from "../../../src/modules/businesses/daos/business-input.dao";
import { BusinessOutputDao } from "../../../src/modules/businesses/daos/business-output.dao";
import { KYSELY_MODULE_CONNECTION_TOKEN } from "nestjs-kysely";
import { v4 as uuidv4 } from "uuid";
import { sql } from "kysely";

describe("BusinessProductionDao (Integration)", () => {
  let dao: BusinessProductionDao;
  let businessDao: BusinessDao;
  let kysely: any;
  let module: TestingModule;
  let testBusinessId: string;

  beforeEach(async () => {
    testBusinessId = uuidv4();

    // Mock Kysely query builder chain
    const mockQueryBuilder = {
      selectFrom: jest.fn().mockReturnThis(),
      selectAll: jest.fn().mockReturnThis(),
      insertInto: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      updateTable: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returningAll: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      executeTakeFirst: jest.fn(),
    };

    kysely = {
      selectFrom: jest.fn().mockReturnValue(mockQueryBuilder),
      insertInto: jest.fn().mockReturnValue(mockQueryBuilder),
      updateTable: jest.fn().mockReturnValue(mockQueryBuilder),
      sql: jest.fn(),
    };

    // Mock sql template tag
    (sql as any).literal = jest.fn((value: string) => value);

    // Mock BusinessDao, BusinessInputDao, and BusinessOutputDao
    const mockBusinessDao = {
      createBusiness: jest.fn().mockResolvedValue(uuidv4()),
    };

    const mockBusinessInputDao = {};
    const mockBusinessOutputDao = {};

    module = await Test.createTestingModule({
      providers: [
        BusinessProductionDao,
        {
          provide: KYSELY_MODULE_CONNECTION_TOKEN(),
          useValue: kysely,
        },
        {
          provide: BusinessDao,
          useValue: mockBusinessDao,
        },
        {
          provide: BusinessInputDao,
          useValue: mockBusinessInputDao,
        },
        {
          provide: BusinessOutputDao,
          useValue: mockBusinessOutputDao,
        },
      ],
    }).compile();

    dao = module.get<BusinessProductionDao>(BusinessProductionDao);
    businessDao = module.get<BusinessDao>(BusinessDao);
    (dao as any).kysely = kysely;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe("getOrCreateProduction", () => {
    it("should create a production record if it doesn't exist", async () => {
      const mockRecord = {
        business_id: testBusinessId,
        accumulated_time: 0,
        last_updated: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      // First call returns null (not found), second call creates it
      const queryBuilder = kysely.selectFrom("business_production");
      queryBuilder.selectAll.mockReturnValue({
        where: jest.fn().mockReturnValue({
          executeTakeFirst: jest.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(mockRecord),
        }),
      });

      const insertBuilder = kysely.insertInto("business_production");
      insertBuilder.values.mockReturnValue({
        returningAll: jest.fn().mockReturnValue({
          executeTakeFirst: jest.fn().mockResolvedValue(mockRecord),
        }),
      });

      const record = await dao.getOrCreateProduction(testBusinessId);
      expect(record).toBeDefined();
      expect(record?.business_id).toBe(testBusinessId);
      expect(record?.accumulated_time).toBe(0);
    });

    it("should return existing record if it exists", async () => {
      const mockRecord = {
        business_id: testBusinessId,
        accumulated_time: 100,
        last_updated: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      const queryBuilder = kysely.selectFrom("business_production");
      queryBuilder.selectAll.mockReturnValue({
        where: jest.fn().mockReturnValue({
          executeTakeFirst: jest.fn().mockResolvedValue(mockRecord),
        }),
      });

      const record = await dao.getOrCreateProduction(testBusinessId);
      expect(record).toBeDefined();
      expect(record?.accumulated_time).toBe(100);
    });
  });

  describe("addTime", () => {
    it("should add time to production", async () => {
      const queryBuilder = kysely.updateTable("business_production");
      queryBuilder.set.mockReturnValue({
        where: jest.fn().mockReturnValue({
          executeTakeFirst: jest.fn().mockResolvedValue({ numUpdatedRows: 1 }),
        }),
      });

      const success = await dao.addTime(testBusinessId, 60);
      expect(success).toBe(true);
      expect(kysely.updateTable).toHaveBeenCalledWith("business_production");
    });

    it("should accumulate time correctly", async () => {
      const queryBuilder = kysely.updateTable("business_production");
      queryBuilder.set.mockReturnValue({
        where: jest.fn().mockReturnValue({
          executeTakeFirst: jest.fn().mockResolvedValue({ numUpdatedRows: 1 }),
        }),
      });

      const success1 = await dao.addTime(testBusinessId, 30);
      const success2 = await dao.addTime(testBusinessId, 40);
      expect(success1).toBe(true);
      expect(success2).toBe(true);
    });
  });

  describe("consumeTime", () => {
    it("should consume time from production", async () => {
      const queryBuilder = kysely.updateTable("business_production");
      queryBuilder.set.mockReturnValue({
        where: jest.fn().mockReturnValue({
          executeTakeFirst: jest.fn().mockResolvedValue({ numUpdatedRows: 1 }),
        }),
      });

      const success = await dao.consumeTime(testBusinessId, 30);
      expect(success).toBe(true);
    });

    it("should not go below zero", async () => {
      const queryBuilder = kysely.updateTable("business_production");
      queryBuilder.set.mockReturnValue({
        where: jest.fn().mockReturnValue({
          executeTakeFirst: jest.fn().mockResolvedValue({ numUpdatedRows: 1 }),
        }),
      });

      const success = await dao.consumeTime(testBusinessId, 100);
      expect(success).toBe(true);
    });
  });

  describe("getAccumulatedTime", () => {
    it("should return accumulated time", async () => {
      const mockRecord = {
        business_id: testBusinessId,
        accumulated_time: 120,
        last_updated: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      const queryBuilder = kysely.selectFrom("business_production");
      queryBuilder.selectAll.mockReturnValue({
        where: jest.fn().mockReturnValue({
          executeTakeFirst: jest.fn().mockResolvedValue(mockRecord),
        }),
      });

      const time = await dao.getAccumulatedTime(testBusinessId);
      expect(time).toBe(120);
    });

    it("should return 0 for new business", async () => {
      const queryBuilder = kysely.selectFrom("business_production");
      queryBuilder.selectAll.mockReturnValue({
        where: jest.fn().mockReturnValue({
          executeTakeFirst: jest.fn().mockResolvedValue(null),
        }),
      });

      const insertBuilder = kysely.insertInto("business_production");
      insertBuilder.values.mockReturnValue({
        returningAll: jest.fn().mockReturnValue({
          executeTakeFirst: jest.fn().mockResolvedValue({
            business_id: testBusinessId,
            accumulated_time: 0,
          }),
        }),
      });

      const time = await dao.getAccumulatedTime(testBusinessId);
      expect(time).toBe(0);
    });
  });

  describe("resetProduction", () => {
    it("should reset accumulated time to zero", async () => {
      const queryBuilder = kysely.updateTable("business_production");
      queryBuilder.set.mockReturnValue({
        where: jest.fn().mockReturnValue({
          executeTakeFirst: jest.fn().mockResolvedValue({ numUpdatedRows: 1 }),
        }),
      });

      const success = await dao.resetProduction(testBusinessId);
      expect(success).toBe(true);
    });
  });
});
