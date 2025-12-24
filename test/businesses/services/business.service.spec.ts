import { Test, TestingModule } from "@nestjs/testing";
import { BusinessService } from "../../../src/modules/businesses/services/business.service";
import { BusinessDao } from "../../../src/modules/businesses/daos/business.dao";
import { BusinessInputDao } from "../../../src/modules/businesses/daos/business-input.dao";
import { BusinessOutputDao } from "../../../src/modules/businesses/daos/business-output.dao";
import { BusinessProductionDao } from "../../../src/modules/businesses/daos/business-production.dao";
import { CorporationDao } from "../../../src/modules/corporations/daos/corporation.dao";
import { AssetHoldingDao } from "../../../src/modules/assets/daos/asset-holding.dao";
import { BusinessFactory } from "../../../src/modules/businesses/factories/business-factory";
import { SpecialBusinessStrategies } from "../../../src/modules/businesses/strategies/special-business-strategies";
import { CreateBusinessDto } from "../../../src/modules/businesses/dtos/create-business.dto";
import { BusinessDto } from "../../../src/modules/businesses/dtos/business.dto";
import { ClaimOutputDto } from "../../../src/modules/businesses/dtos/claim-output.dto";
import { AddProductionTimeDto } from "../../../src/modules/businesses/dtos/add-production-time.dto";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { Business } from "../../../src/modules/businesses/classes/business.class";
import { v4 as uuidv4 } from "uuid";

describe("BusinessService", () => {
  let service: BusinessService;
  let businessDao: jest.Mocked<BusinessDao>;
  let businessInputDao: jest.Mocked<BusinessInputDao>;
  let businessOutputDao: jest.Mocked<BusinessOutputDao>;
  let businessProductionDao: jest.Mocked<BusinessProductionDao>;
  let corporationDao: jest.Mocked<CorporationDao>;
  let assetHoldingDao: jest.Mocked<AssetHoldingDao>;
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
          },
        },
        {
          provide: BusinessInputDao,
          useValue: {
            createInput: jest.fn(),
            getInputsByBusinessId: jest.fn(),
            deleteInput: jest.fn(),
            deleteInputsByBusinessId: jest.fn(),
          },
        },
        {
          provide: BusinessOutputDao,
          useValue: {
            createOutput: jest.fn(),
            getOutputsByBusinessId: jest.fn(),
            deleteOutput: jest.fn(),
            deleteOutputsByBusinessId: jest.fn(),
          },
        },
        {
          provide: BusinessProductionDao,
          useValue: {
            getOrCreateProduction: jest.fn(),
            addTime: jest.fn(),
            consumeTime: jest.fn(),
            getAccumulatedTime: jest.fn(),
            resetProduction: jest.fn(),
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
    businessInputDao = module.get(BusinessInputDao);
    businessOutputDao = module.get(BusinessOutputDao);
    businessProductionDao = module.get(BusinessProductionDao);
    corporationDao = module.get(CorporationDao);
    assetHoldingDao = module.get(AssetHoldingDao);
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
      businessDao.getBusinessById.mockResolvedValue(mockBusiness);
      businessInputDao.getInputsByBusinessId.mockResolvedValue([]);
      businessOutputDao.getOutputsByBusinessId.mockResolvedValue([]);

      const result = await service.createBusiness(createDto);

      expect(result).toEqual(mockBusiness);
      expect(businessDao.createBusiness).toHaveBeenCalledWith(createDto);
      expect(corporationDao.getCorporationById).toHaveBeenCalledWith("corp-123");
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

    it("should create inputs and outputs if provided", async () => {
      const createDto: CreateBusinessDto = {
        name: "Test Farm",
        category: "agriculture",
        corporationId: "corp-123",
        inputs: [
          {
            assetId: "asset-1",
            quantity: 10,
          },
        ],
        outputs: [
          {
            assetId: "asset-2",
            quantity: 5,
            productionTime: 60,
          },
        ],
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

      corporationDao.getCorporationById.mockResolvedValue({
        id: "corp-123",
      } as any);
      businessDao.getBusinessByName.mockResolvedValue(null);
      businessDao.createBusiness.mockResolvedValue(mockBusinessId);
      businessInputDao.createInput.mockResolvedValue("input-id");
      businessOutputDao.createOutput.mockResolvedValue("output-id");
      businessDao.getBusinessById.mockResolvedValue(mockBusiness);
      businessInputDao.getInputsByBusinessId.mockResolvedValue([]);
      businessOutputDao.getOutputsByBusinessId.mockResolvedValue([]);

      await service.createBusiness(createDto);

      expect(businessInputDao.createInput).toHaveBeenCalledWith(
        mockBusinessId,
        createDto.inputs![0]
      );
      expect(businessOutputDao.createOutput).toHaveBeenCalledWith(
        mockBusinessId,
        createDto.outputs![0]
      );
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
      businessInputDao.getInputsByBusinessId.mockResolvedValue([]);
      businessOutputDao.getOutputsByBusinessId.mockResolvedValue([]);

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

  describe("addProductionTime", () => {
    it("should add production time successfully", async () => {
      const businessId = uuidv4();
      const mockBusiness: BusinessDto = {
        id: businessId,
        name: "Test Farm",
        category: "agriculture",
        corporationId: "corp-123",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      businessDao.getBusinessById.mockResolvedValue(mockBusiness);
      businessProductionDao.addTime.mockResolvedValue(true);
      businessProductionDao.getAccumulatedTime.mockResolvedValue(120);
      businessInputDao.getInputsByBusinessId.mockResolvedValue([]);
      businessOutputDao.getOutputsByBusinessId.mockResolvedValue([]);

      const mockBusinessInstance = {
        calculateAvailableOutputs: jest.fn().mockReturnValue([]),
      };
      businessFactory.createBusiness.mockReturnValue(
        mockBusinessInstance as any
      );

      const result = await service.addProductionTime(businessId, {
        timeSeconds: 120,
      });

      expect(result.accumulatedTime).toBe(120);
      expect(businessProductionDao.addTime).toHaveBeenCalledWith(
        businessId,
        120
      );
    });

    it("should throw NotFoundException if business not found", async () => {
      businessDao.getBusinessById.mockResolvedValue(null);

      await expect(
        service.addProductionTime("invalid-id", { timeSeconds: 120 })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("claimOutput", () => {
    it("should claim outputs and consume inputs", async () => {
      const businessId = uuidv4();
      const corporationId = uuidv4();
      const outputId = uuidv4();
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
            id: uuidv4(),
            businessId,
            assetId: inputAssetId,
            name: "Water",
            quantity: 10,
          },
        ],
        outputs: [
          {
            id: outputId,
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
      // accumulatedTime = 60 seconds = 2 cycles
      businessProductionDao.getAccumulatedTime.mockResolvedValue(60); // 2 cycles available
      assetHoldingDao.getAsset.mockResolvedValue({
        corporationId,
        assetId: inputAssetId,
        quantity: 25, // Enough for 2 cycles (10 * 2 = 20)
      } as any);
      assetHoldingDao.adjustAssetQuantity.mockResolvedValue(true);
      businessProductionDao.consumeTime.mockResolvedValue(true);
      businessInputDao.getInputsByBusinessId.mockResolvedValue(
        mockBusiness.inputs!
      );
      businessOutputDao.getOutputsByBusinessId.mockResolvedValue(
        mockBusiness.outputs!
      );

      const result = await service.claimOutput(businessId, {
        outputId,
      });

      expect(result.quantity).toBe(10); // 2 cycles * 5 quantity
      expect(result.cyclesClaimed).toBe(2);
      expect(assetHoldingDao.adjustAssetQuantity).toHaveBeenCalledWith(
        corporationId,
        inputAssetId,
        -20
      );
      expect(assetHoldingDao.adjustAssetQuantity).toHaveBeenCalledWith(
        corporationId,
        assetId,
        10
      );
    });

    it("should throw NotFoundException if business not found", async () => {
      businessDao.getBusinessById.mockResolvedValue(null);

      await expect(
        service.claimOutput("invalid-id", { outputId: uuidv4() })
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
      businessInputDao.getInputsByBusinessId.mockResolvedValue([]);
      businessOutputDao.getOutputsByBusinessId.mockResolvedValue([]);

      await expect(
        service.claimOutput(businessId, { outputId: "invalid-output" })
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if insufficient inputs", async () => {
      const businessId = uuidv4();
      const corporationId = uuidv4();
      const outputId = uuidv4();
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
            id: uuidv4(),
            businessId,
            assetId: inputAssetId,
            name: "Water",
            quantity: 10,
          },
        ],
        outputs: [
          {
            id: outputId,
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
      businessProductionDao.getAccumulatedTime.mockResolvedValue(120);
      assetHoldingDao.getAsset.mockResolvedValue({
        corporationId,
        assetId: inputAssetId,
        quantity: 10, // Not enough for 2 cycles (need 20)
      } as any);
      businessInputDao.getInputsByBusinessId.mockResolvedValue(
        mockBusiness.inputs!
      );
      businessOutputDao.getOutputsByBusinessId.mockResolvedValue(
        mockBusiness.outputs!
      );

      await expect(
        service.claimOutput(businessId, { outputId })
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

