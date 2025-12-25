import { Test, TestingModule } from "@nestjs/testing";
import { BusinessService } from "../../../src/modules/businesses/services/business.service";
import { BusinessDao } from "../../../src/modules/businesses/daos/business.dao";
import { ProductionDao } from "../../../src/modules/businesses/daos/production.dao";
import { CorporationDao } from "../../../src/modules/corporations/daos/corporation.dao";
import { AssetHoldingDao } from "../../../src/modules/assets/daos/asset-holding.dao";
import { AssetService } from "../../../src/modules/assets/services/asset.service";
import { BusinessFactory } from "../../../src/modules/businesses/factories/business-factory";
import { SpecialBusinessStrategies } from "../../../src/modules/businesses/strategies/special-business-strategies";
import { CreateBusinessDto } from "../../../src/modules/businesses/dtos/create-business.dto";
import { BusinessDto } from "../../../src/modules/businesses/dtos/business.dto";
import { ClaimOutputDto } from "../../../src/modules/businesses/dtos/claim-output.dto";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { Business } from "../../../src/modules/businesses/classes/business.class";
import { v4 as uuidv4 } from "uuid";
import { AssetDto } from "../../../src/modules/assets/dtos/asset.dto";

describe("BusinessService", () => {
  let service: BusinessService;
  let businessDao: jest.Mocked<BusinessDao>;
  let productionDao: jest.Mocked<ProductionDao>;
  let corporationDao: jest.Mocked<CorporationDao>;
  let assetHoldingDao: jest.Mocked<AssetHoldingDao>;
  let assetService: jest.Mocked<AssetService>;
  let businessFactory: jest.Mocked<BusinessFactory>;
  let specialStrategies: jest.Mocked<SpecialBusinessStrategies>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,
        {
          provide: BusinessDao,
          useValue: {
            createBusiness: jest.fn(),
            getBusinessById: jest.fn(),
            getBusinessByName: jest.fn(),
            updateBusiness: jest.fn(),
            deleteBusiness: jest.fn(),
            getBusinesses: jest.fn(),
            getLastClaimedAt: jest.fn(),
            updateLastClaimedAt: jest.fn(),
          },
        },
        {
          provide: ProductionDao,
          useValue: {
            getBatchesByBusinessId: jest.fn(),
            getBatchesWithAvailableCycles: jest.fn(),
            createBatch: jest.fn(),
            getActiveBatches: jest.fn(),
            markBatchCompleted: jest.fn(),
            updateBatchCycles: jest.fn(),
            getBatchById: jest.fn(),
          },
        },
        {
          provide: CorporationDao,
          useValue: {
            getCorporationById: jest.fn(),
          },
        },
        {
          provide: AssetHoldingDao,
          useValue: {
            getAsset: jest.fn(),
            adjustAssetQuantity: jest.fn(),
          },
        },
        {
          provide: AssetService,
          useValue: {
            getAssetBySymbol: jest.fn(),
            createAsset: jest.fn(),
            getAssetById: jest.fn(),
          },
        },
        {
          provide: BusinessFactory,
          useValue: {
            createBusiness: jest.fn(),
            isSupportedType: jest.fn((type: string) =>
              ["agriculture", "mining", "industry_manufacturing"].includes(type)
            ),
            getSupportedTypes: jest.fn(() => [
              "agriculture",
              "mining",
              "industry_manufacturing",
            ]),
          },
        },
        {
          provide: SpecialBusinessStrategies,
          useValue: {
            getStrategy: jest.fn().mockReturnValue(null),
            hasStrategy: jest.fn().mockReturnValue(false),
            registerStrategy: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BusinessService>(BusinessService);
    businessDao = module.get(BusinessDao);
    productionDao = module.get(ProductionDao);
    corporationDao = module.get(CorporationDao);
    assetHoldingDao = module.get(AssetHoldingDao);
    assetService = module.get(AssetService);
    businessFactory = module.get(BusinessFactory);
    specialStrategies = module.get(SpecialBusinessStrategies);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createBusiness", () => {
    it("should create a business successfully", async () => {
      const createDto: CreateBusinessDto = {
        name: "Test Farm",
        category: "agriculture",
        corporationId: "corp-123",
        isActive: true,
      };

      const mockBusinessId = uuidv4();
      const mockBusiness: BusinessDto = {
        id: mockBusinessId,
        name: createDto.name,
        category: createDto.category,
        corporationId: createDto.corporationId,
        description: createDto.description,
        isActive: createDto.isActive ?? true,
        inputs: [],
        outputs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      corporationDao.getCorporationById.mockResolvedValue({
        id: "corp-123",
      } as any);
      businessDao.getBusinessByName.mockResolvedValue(null);
      businessDao.createBusiness.mockResolvedValue(mockBusinessId);
      
      // Mock recipe resolution - agriculture recipe creates WHEAT output
      const wheatAsset: AssetDto = {
        id: uuidv4(),
        symbol: "WHEAT",
        name: "Wheat",
        type: "commodity",
        decimals: 8,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      // Mock AssetService for recipe resolution
      assetService.getAssetBySymbol.mockRejectedValue(new NotFoundException("Asset not found"));
      assetService.createAsset.mockResolvedValue(wheatAsset);
      
      // BusinessDao will resolve inputs/outputs from recipes
      businessDao.getBusinessById.mockResolvedValue({
        ...mockBusiness,
        outputs: [{
          businessId: mockBusinessId,
          assetId: wheatAsset.id,
          name: "Wheat",
          quantity: 5,
          productionTime: 60,
        }],
      });

      const result = await service.createBusiness(createDto);

      expect(result).toBeDefined();
      expect(businessDao.createBusiness).toHaveBeenCalledWith(createDto);
      expect(corporationDao.getCorporationById).toHaveBeenCalledWith("corp-123");
      // BusinessDao will resolve outputs from recipe when getBusinessById is called
      expect(businessDao.getBusinessById).toHaveBeenCalledWith(mockBusinessId);
    });

    it("should throw NotFoundException if corporation does not exist", async () => {
      corporationDao.getCorporationById.mockResolvedValue(null);

      await expect(
        service.createBusiness({
          name: "Test Farm",
          category: "agriculture",
          corporationId: "invalid-corp",
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if business name already exists", async () => {
      corporationDao.getCorporationById.mockResolvedValue({
        id: "corp-123",
      } as any);
      businessDao.getBusinessByName.mockResolvedValue({
        id: "existing-id",
        name: "Test Farm",
      } as BusinessDto);

      await expect(
        service.createBusiness({
          name: "Test Farm",
          category: "agriculture",
          corporationId: "corp-123",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("should create inputs and outputs from recipe only", async () => {
      const createDto: CreateBusinessDto = {
        name: "Test Farm",
        category: "agriculture",
        corporationId: "corp-123",
        // No inputs/outputs - should use recipe
      };

      const mockBusinessId = uuidv4();
      const mockBusiness: BusinessDto = {
        id: mockBusinessId,
        name: createDto.name,
        category: createDto.category,
        corporationId: createDto.corporationId,
        isActive: true,
        inputs: [],
        outputs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock recipe resolution - agriculture recipe creates WHEAT output
      const wheatAsset: AssetDto = {
        id: uuidv4(),
        symbol: "WHEAT",
        name: "Wheat",
        type: "commodity",
        decimals: 8,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      corporationDao.getCorporationById.mockResolvedValue({
        id: "corp-123",
      } as any);
      businessDao.getBusinessByName.mockResolvedValue(null);
      businessDao.createBusiness.mockResolvedValue(mockBusinessId);
      // Mock AssetService for recipe resolution
      assetService.getAssetBySymbol.mockRejectedValue(new NotFoundException("Asset not found"));
      assetService.createAsset.mockResolvedValue(wheatAsset);
      // BusinessDao will resolve inputs/outputs from recipes
      businessDao.getBusinessById.mockResolvedValue({
        ...mockBusiness,
        outputs: [{
          businessId: mockBusinessId,
          assetId: wheatAsset.id,
          name: "Wheat",
          quantity: 5,
          productionTime: 60,
        }],
      });

      await service.createBusiness(createDto);

      // BusinessDao handles recipe resolution internally
      expect(businessDao.createBusiness).toHaveBeenCalledWith(createDto);
      expect(businessDao.getBusinessById).toHaveBeenCalledWith(mockBusinessId);
    });
  });

  describe("getBusinessById", () => {
    it("should return a business if found", async () => {
      const mockBusiness: BusinessDto = {
        id: "business-123",
        name: "Test Farm",
        category: "agriculture",
        corporationId: "corp-123",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      businessDao.getBusinessById.mockResolvedValue(mockBusiness);

      const result = await service.getBusinessById("business-123");

      expect(result).toEqual(mockBusiness);
      expect(businessDao.getBusinessById).toHaveBeenCalledWith("business-123");
    });

    it("should throw NotFoundException if business not found", async () => {
      businessDao.getBusinessById.mockResolvedValue(null);

      await expect(service.getBusinessById("invalid-id")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("claimOutput", () => {
    it("should claim outputs and consume inputs", async () => {
      const businessId = uuidv4();
      const corporationId = uuidv4();
      const assetId = uuidv4();
      const inputAssetId = uuidv4();

      const mockBusiness: BusinessDto = {
        id: businessId,
        name: "Test Farm",
        category: "agriculture",
        corporationId,
        isActive: true,
        inputs: [
          {
            businessId,
            assetId: inputAssetId,
            name: "Water",
            quantity: 10,
          },
        ],
        outputs: [
          {
            businessId,
            assetId,
            name: "Wheat",
            quantity: 5,
            productionTime: 60,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBusinessInstance = {
        getType: () => "agriculture",
        getBaseProductionRate: () => 2.0,
        getDefaultProductionTime: () => 60,
        validateClaim: jest.fn().mockResolvedValue(undefined),
        validateInputs: jest.fn().mockResolvedValue(undefined),
      };

      businessDao.getBusinessById.mockResolvedValue(mockBusiness);
      businessFactory.createBusiness.mockReturnValue(
        mockBusinessInstance as any
      );
      
      // With baseProductionRate = 2.0 and defaultProductionTime = 60:
      // effectiveTime = 60 / 2.0 = 30 seconds per cycle
      // Create a batch that started 60 seconds ago with cycle_completion_time = 30
      // This gives us 2 cycles available (60 / 30 = 2)
      const mockBatch = {
        id: uuidv4(),
        business_id: businessId,
        cycles: 2,
        cycles_remaining: 2,
        input_quantities: { [inputAssetId]: 20 }, // 10 * 2 cycles
        production_started_at: new Date(Date.now() - 60000), // 60 seconds ago
        cycle_completion_time: 30, // 30 seconds per cycle
        status: "active" as const,
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      productionDao.getBatchesWithAvailableCycles.mockResolvedValue([mockBatch]);
      productionDao.updateBatchCycles.mockResolvedValue(true);
      businessDao.updateLastClaimedAt.mockResolvedValue(true);
      productionDao.getBatchesByBusinessId.mockResolvedValue([]);
      businessDao.getLastClaimedAt.mockResolvedValue(null);
      assetHoldingDao.adjustAssetQuantity.mockResolvedValue(true);

      const result = await service.claimOutput(businessId, {
        assetId,
      });

      expect(result.quantity).toBe(10); // 2 cycles * 5 quantity
      expect(result.cyclesClaimed).toBe(2);
      expect(assetHoldingDao.adjustAssetQuantity).toHaveBeenCalledWith(
        corporationId,
        assetId,
        10
      );
      expect(productionDao.updateBatchCycles).toHaveBeenCalled();
    });

    it("should throw NotFoundException if business not found", async () => {
      businessDao.getBusinessById.mockResolvedValue(null);

      await expect(
        service.claimOutput("invalid-id", { assetId: uuidv4() })
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if output not found", async () => {
      const businessId = uuidv4();
      const mockBusiness: BusinessDto = {
        id: businessId,
        name: "Test Farm",
        category: "agriculture",
        corporationId: "corp-123",
        isActive: true,
        outputs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      businessDao.getBusinessById.mockResolvedValue(mockBusiness);

      await expect(
        service.claimOutput(businessId, { assetId: uuidv4() })
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if insufficient cycles available", async () => {
      const businessId = uuidv4();
      const corporationId = uuidv4();
      const assetId = uuidv4();

      const mockBusiness: BusinessDto = {
        id: businessId,
        name: "Test Farm",
        category: "agriculture",
        corporationId,
        isActive: true,
        inputs: [],
        outputs: [
          {
            businessId,
            assetId,
            name: "Wheat",
            quantity: 5,
            productionTime: 60,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBusinessInstance = {
        getType: () => "agriculture",
        getBaseProductionRate: () => 2.0,
        getDefaultProductionTime: () => 60,
        validateClaim: jest.fn().mockResolvedValue(undefined),
        validateInputs: jest.fn().mockResolvedValue(undefined),
      };

      businessDao.getBusinessById.mockResolvedValue(mockBusiness);
      businessFactory.createBusiness.mockReturnValue(
        mockBusinessInstance as any
      );
      // No batches available - should throw error when trying to claim
      productionDao.getBatchesWithAvailableCycles.mockResolvedValue([]);

      await expect(
        service.claimOutput(businessId, { assetId })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getSupportedBusinessTypes", () => {
    it("should return supported business types", () => {
      const types = service.getSupportedBusinessTypes();
      expect(types).toContain("agriculture");
      expect(types).toContain("mining");
      expect(businessFactory.getSupportedTypes).toHaveBeenCalled();
    });
  });
});

