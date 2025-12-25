import { Test, TestingModule } from "@nestjs/testing";
import { BusinessDao } from "../../../src/modules/businesses/daos/business.dao";
import { AssetService } from "../../../src/modules/assets/services/asset.service";
import { CreateBusinessDto } from "../../../src/modules/businesses/dtos/create-business.dto";
import { BusinessFiltersDto } from "../../../src/modules/businesses/dtos/business-filters.dto";
import { UpdateBusinessDto } from "../../../src/modules/businesses/dtos/update-business.dto";
import { KYSELY_MODULE_CONNECTION_TOKEN } from "nestjs-kysely";
import { v4 as uuidv4 } from "uuid";

describe("BusinessDao (Integration)", () => {
  let dao: BusinessDao;
  let assetService: AssetService;
  let kysely: any;
  let module: TestingModule;
  let testCorporationId: string;

  beforeEach(async () => {
    testCorporationId = uuidv4();

    // Create a helper function to build query builder chains
    // Each operation needs its own builder instance to avoid conflicts
    const createQueryBuilder = () => {
      const builder: any = {
        selectFrom: jest.fn().mockReturnThis(),
        selectAll: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insertInto: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        updateTable: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        deleteFrom: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        returningAll: jest.fn().mockReturnThis(),
        execute: jest.fn(),
        executeTakeFirst: jest.fn(),
      };
      return builder;
    };

    kysely = {
      selectFrom: jest.fn().mockReturnValue(createQueryBuilder()),
      insertInto: jest.fn().mockReturnValue(createQueryBuilder()),
      updateTable: jest.fn().mockReturnValue(createQueryBuilder()),
      deleteFrom: jest.fn().mockReturnValue(createQueryBuilder()),
    };

    // Mock AssetService for recipe resolution
    const mockAssetService = {
      getAssetBySymbol: jest.fn().mockResolvedValue({
        id: uuidv4(),
        symbol: "WHEAT",
        name: "Wheat",
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        BusinessDao,
        {
          provide: KYSELY_MODULE_CONNECTION_TOKEN(),
          useValue: kysely,
        },
        {
          provide: AssetService,
          useValue: mockAssetService,
        },
      ],
    }).compile();

    dao = module.get<BusinessDao>(BusinessDao);
    assetService = module.get<AssetService>(AssetService);
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

  describe("createBusiness", () => {
    it("should create a business in the database", async () => {
      const createDto: CreateBusinessDto = {
        name: "Test Farm",
        category: "agriculture",
        corporationId: testCorporationId,
        isActive: true,
      };

      const mockBusinessId = uuidv4();
      const insertBuilder = kysely.insertInto("businesses");
      insertBuilder.values.mockReturnValue(insertBuilder);
      insertBuilder.returning.mockReturnValue(insertBuilder);
      insertBuilder.returningAll.mockReturnValue(insertBuilder);
      insertBuilder.executeTakeFirst.mockResolvedValue({ id: mockBusinessId });

      const businessId = await dao.createBusiness(createDto);
      expect(businessId).toBe(mockBusinessId);
      expect(kysely.insertInto).toHaveBeenCalledWith("businesses");
    });

    it("should return null on database error", async () => {
      const createDto: CreateBusinessDto = {
        name: "Test Farm",
        category: "agriculture",
        corporationId: "invalid-corporation-id",
        isActive: true,
      };

      const insertBuilder = kysely.insertInto("businesses");
      insertBuilder.values.mockReturnValue(insertBuilder);
      insertBuilder.returning.mockReturnValue(insertBuilder);
      insertBuilder.returningAll.mockReturnValue(insertBuilder);
      insertBuilder.executeTakeFirst.mockRejectedValue(new Error("Database error"));

      const businessId = await dao.createBusiness(createDto);
      expect(businessId).toBeNull();
    });
  });

  describe("getBusinessById", () => {
    it("should retrieve a business by ID", async () => {
      const businessId = uuidv4();
      const mockBusiness = {
        id: businessId,
        name: "Test Farm",
        category: "agriculture",
        corporation_id: testCorporationId,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const selectBuilder = kysely.selectFrom("businesses");
      selectBuilder.selectAll.mockReturnValue(selectBuilder);
      selectBuilder.where.mockReturnValue(selectBuilder);
      selectBuilder.executeTakeFirst.mockResolvedValue(mockBusiness);

      const business = await dao.getBusinessById(businessId);
      expect(business).toBeDefined();
      expect(business?.id).toBe(businessId);
    });

    it("should return null for non-existent business", async () => {
      const selectBuilder = kysely.selectFrom("businesses");
      selectBuilder.selectAll.mockReturnValue(selectBuilder);
      selectBuilder.where.mockReturnValue(selectBuilder);
      selectBuilder.executeTakeFirst.mockResolvedValue(null);

      const business = await dao.getBusinessById("non-existent-id");
      expect(business).toBeNull();
    });
  });

  describe("getBusinessByName", () => {
    it("should retrieve a business by name", async () => {
      const businessId = uuidv4();
      const mockBusiness = {
        id: businessId,
        name: "Unique Farm Name",
        category: "agriculture",
        corporation_id: testCorporationId,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const selectBuilder = kysely.selectFrom("businesses");
      selectBuilder.selectAll.mockReturnValue(selectBuilder);
      selectBuilder.where.mockReturnValue(selectBuilder);
      selectBuilder.executeTakeFirst.mockResolvedValue(mockBusiness);

      const business = await dao.getBusinessByName("Unique Farm Name");
      expect(business).toBeDefined();
      expect(business?.name).toBe("Unique Farm Name");
    });

    it("should return null for non-existent name", async () => {
      const selectBuilder = kysely.selectFrom("businesses");
      selectBuilder.selectAll.mockReturnValue(selectBuilder);
      selectBuilder.where.mockReturnValue(selectBuilder);
      selectBuilder.executeTakeFirst.mockResolvedValue(null);

      const business = await dao.getBusinessByName("Non Existent Name");
      expect(business).toBeNull();
    });
  });

  describe("updateBusiness", () => {
    it("should update a business", async () => {
      const businessId = uuidv4();
      const updateDto: UpdateBusinessDto = {
        name: "Updated Farm Name",
        description: "Updated description",
        isActive: false,
      };

      const updateBuilder = kysely.updateTable("businesses");
      updateBuilder.set.mockReturnValue(updateBuilder);
      updateBuilder.where.mockReturnValue(updateBuilder);
      updateBuilder.executeTakeFirst.mockResolvedValue({ numUpdatedRows: 1 });

      const success = await dao.updateBusiness(businessId, updateDto);
      expect(success).toBe(true);
      expect(kysely.updateTable).toHaveBeenCalledWith("businesses");
    });

    it("should return false for non-existent business", async () => {
      const updateDto: UpdateBusinessDto = {
        name: "Updated Name",
      };

      const updateBuilder = kysely.updateTable("businesses");
      updateBuilder.set.mockReturnValue(updateBuilder);
      updateBuilder.where.mockReturnValue(updateBuilder);
      updateBuilder.executeTakeFirst.mockResolvedValue({ numUpdatedRows: 0 });

      const success = await dao.updateBusiness("non-existent-id", updateDto);
      expect(success).toBe(false);
    });
  });

  describe("deleteBusiness", () => {
    it("should delete a business", async () => {
      const businessId = uuidv4();

      const deleteBuilder = kysely.deleteFrom("businesses");
      deleteBuilder.where.mockReturnValue(deleteBuilder);
      deleteBuilder.executeTakeFirst.mockResolvedValue({ numDeletedRows: 1 });

      const success = await dao.deleteBusiness(businessId);
      expect(success).toBe(true);
      expect(kysely.deleteFrom).toHaveBeenCalledWith("businesses");
    });

    it("should return false for non-existent business", async () => {
      const deleteBuilder = kysely.deleteFrom("businesses");
      deleteBuilder.where.mockReturnValue(deleteBuilder);
      deleteBuilder.executeTakeFirst.mockResolvedValue({ numDeletedRows: 0 });

      const success = await dao.deleteBusiness("non-existent-id");
      expect(success).toBe(false);
    });
  });

  describe("getBusinesses", () => {
    it("should filter by corporation ID", async () => {
      const filters: BusinessFiltersDto = {
        corporationId: testCorporationId,
      };

      const mockBusinesses = [
        {
          id: uuidv4(),
          name: "Farm 1",
          category: "agriculture",
          corporation_id: testCorporationId,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: uuidv4(),
          name: "Farm 2",
          category: "agriculture",
          corporation_id: testCorporationId,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const selectBuilder = kysely.selectFrom("businesses");
      selectBuilder.selectAll.mockReturnValue(selectBuilder);
      selectBuilder.where.mockReturnValue(selectBuilder);
      selectBuilder.orderBy.mockReturnValue(selectBuilder);
      selectBuilder.execute.mockResolvedValue(mockBusinesses);

      const businesses = await dao.getBusinesses(filters);
      expect(businesses.length).toBeGreaterThanOrEqual(2);
      businesses.forEach((b) => {
        expect(b.corporationId).toBe(testCorporationId);
      });
    });

    it("should filter by category", async () => {
      const filters: BusinessFiltersDto = {
        category: "agriculture",
      };

      const mockBusinesses = [
        {
          id: uuidv4(),
          name: "Test Farm",
          category: "agriculture",
          corporation_id: testCorporationId,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const selectBuilder = kysely.selectFrom("businesses");
      const whereBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnValue({
          execute: jest.fn().mockResolvedValue(mockBusinesses),
        }),
      };
      selectBuilder.selectAll.mockReturnValue(whereBuilder);

      const businesses = await dao.getBusinesses(filters);
      expect(businesses.length).toBeGreaterThanOrEqual(1);
      businesses.forEach((b) => {
        expect(b.category).toBe("agriculture");
      });
    });

    it("should filter by active status", async () => {
      const filters: BusinessFiltersDto = {
        isActive: true,
      };

      const mockBusinesses = [
        {
          id: uuidv4(),
          name: "Active Farm",
          category: "agriculture",
          corporation_id: testCorporationId,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const selectBuilder = kysely.selectFrom("businesses");
      const whereBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnValue({
          execute: jest.fn().mockResolvedValue(mockBusinesses),
        }),
      };
      selectBuilder.selectAll.mockReturnValue(whereBuilder);

      const businesses = await dao.getBusinesses(filters);
      expect(businesses.length).toBeGreaterThanOrEqual(1);
      businesses.forEach((b) => {
        expect(b.isActive).toBe(true);
      });
    });
  });
});
