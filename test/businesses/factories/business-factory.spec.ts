import { Test, TestingModule } from "@nestjs/testing";
import { BusinessFactory } from "../../../src/modules/businesses/factories/business-factory";
import { SpecialBusinessStrategies } from "../../../src/modules/businesses/strategies/special-business-strategies";
import { BusinessDto } from "../../../src/modules/businesses/dtos/business.dto";
import { Business } from "../../../src/modules/businesses/classes/business.class";
import { BusinessType } from "../../../src/modules/businesses/types/business-type";

describe("BusinessFactory", () => {
  let factory: BusinessFactory;
  let specialStrategies: jest.Mocked<SpecialBusinessStrategies>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessFactory,
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

    factory = module.get<BusinessFactory>(BusinessFactory);
    specialStrategies = module.get(SpecialBusinessStrategies);
  });

  describe("createBusiness", () => {
    it("should create a business instance for agriculture type", () => {
      const businessData: BusinessDto = {
        id: "business-123",
        name: "Test Farm",
        category: "agriculture",
        corporationId: "corp-123",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const business = factory.createBusiness(businessData);

      expect(business).toBeInstanceOf(Business);
      expect(business.getType()).toBe("agriculture");
      expect(business.getBaseProductionRate()).toBe(2.0);
      expect(business.getDefaultProductionTime()).toBe(60);
    });

    it("should create a business instance for mining type", () => {
      const businessData: BusinessDto = {
        id: "business-123",
        name: "Test Mine",
        category: "mining",
        corporationId: "corp-123",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const business = factory.createBusiness(businessData);

      expect(business).toBeInstanceOf(Business);
      expect(business.getType()).toBe("mining");
      expect(business.getBaseProductionRate()).toBe(1.5);
      expect(business.getDefaultProductionTime()).toBe(120);
    });

    it("should create a business instance for manufacturing type", () => {
      const businessData: BusinessDto = {
        id: "business-123",
        name: "Test Factory",
        category: "industry_manufacturing",
        corporationId: "corp-123",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const business = factory.createBusiness(businessData);

      expect(business).toBeInstanceOf(Business);
      expect(business.getType()).toBe("industry_manufacturing");
      expect(business.getBaseProductionRate()).toBe(1.0);
      expect(business.getDefaultProductionTime()).toBe(300);
    });

    it("should throw error for unsupported business type", () => {
      const businessData: BusinessDto = {
        id: "business-123",
        name: "Test Business",
        category: "invalid_type" as BusinessType,
        corporationId: "corp-123",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => factory.createBusiness(businessData)).toThrow();
    });

    it("should use strategy if available for business type", () => {
      const mockStrategy = {
        validateClaim: jest.fn(),
      };

      specialStrategies.getStrategy.mockReturnValue(mockStrategy as any);

      const businessData: BusinessDto = {
        id: "business-123",
        name: "Test Commerce",
        category: "commerce",
        corporationId: "corp-123",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const business = factory.createBusiness(businessData);

      expect(business).toBeInstanceOf(Business);
      expect(specialStrategies.getStrategy).toHaveBeenCalledWith("commerce");
    });
  });

  describe("isSupportedType", () => {
    it("should return true for supported types", () => {
      expect(factory.isSupportedType("agriculture")).toBe(true);
      expect(factory.isSupportedType("mining")).toBe(true);
      expect(factory.isSupportedType("commerce")).toBe(true);
    });

    it("should return false for unsupported types", () => {
      expect(factory.isSupportedType("invalid_type")).toBe(false);
      expect(factory.isSupportedType("")).toBe(false);
    });
  });

  describe("getSupportedTypes", () => {
    it("should return all supported business types", () => {
      const types = factory.getSupportedTypes();

      expect(types).toContain("agriculture");
      expect(types).toContain("mining");
      expect(types).toContain("industry_manufacturing");
      expect(types).toContain("commerce");
      expect(types.length).toBeGreaterThan(0);
    });
  });
});

