import { Business } from "../../../src/modules/businesses/classes/business.class";
import { BusinessDto } from "../../../src/modules/businesses/dtos/business.dto";
import { BusinessInputDto } from "../../../src/modules/businesses/dtos/business-input.dto";
import { BusinessOutputDto } from "../../../src/modules/businesses/dtos/business-output.dto";
import { IBusinessStrategy } from "../../../src/modules/businesses/strategies/business-strategy.interface";
import { v4 as uuidv4 } from "uuid";

describe("Business", () => {
  let businessData: BusinessDto;

  beforeEach(() => {
    businessData = {
      id: uuidv4(),
      name: "Test Farm",
      category: "agriculture",
      corporationId: uuidv4(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe("constructor", () => {
    it("should create a business instance with correct configuration", () => {
      const business = new Business(businessData);

      expect(business.getId()).toBe(businessData.id);
      expect(business.getName()).toBe(businessData.name);
      expect(business.getType()).toBe("agriculture");
      expect(business.getCorporationId()).toBe(businessData.corporationId);
      expect(business.isActive()).toBe(true);
      expect(business.getBaseProductionRate()).toBe(2.0);
      expect(business.getDefaultProductionTime()).toBe(60);
    });

    it("should use strategy if provided", () => {
      const mockStrategy: IBusinessStrategy = {
        validateClaim: jest.fn(),
      };

      const business = new Business(businessData, mockStrategy);

      expect(business).toBeDefined();
    });
  });

  describe("getInputs and getOutputs", () => {
    it("should return empty arrays if no inputs/outputs", () => {
      const business = new Business(businessData);

      expect(business.getInputs()).toEqual([]);
      expect(business.getOutputs()).toEqual([]);
    });

    it("should return inputs and outputs if provided", () => {
      const input: BusinessInputDto = {
        businessId: businessData.id,
        assetId: uuidv4(),
        name: "Water",
        quantity: 10,
      };

      const output: BusinessOutputDto = {
        businessId: businessData.id,
        assetId: uuidv4(),
        name: "Wheat",
        quantity: 5,
        productionTime: 60,
      };

      businessData.inputs = [input];
      businessData.outputs = [output];

      const business = new Business(businessData);

      expect(business.getInputs()).toEqual([input]);
      expect(business.getOutputs()).toEqual([output]);
    });
  });

  describe("calculateAvailableOutputs", () => {
    it("should calculate available outputs based on accumulated time", () => {
      const output: BusinessOutputDto = {
        businessId: businessData.id,
        assetId: uuidv4(),
        name: "Wheat",
        quantity: 5,
        productionTime: 60,
      };

      businessData.outputs = [output];
      const business = new Business(businessData);

      // Agriculture has 2.0x rate, so 60s production time becomes 30s effective
      // With 120s accumulated time, should get 4 cycles (120 / 30)
      const result = business.calculateAvailableOutputs(120);

      expect(result).toHaveLength(1);
      expect(result[0].cyclesCompleted).toBe(4);
      expect(result[0].quantityAvailable).toBe(20); // 4 cycles * 5 quantity
    });

    it("should use output-specific production time if provided", () => {
      const output: BusinessOutputDto = {
        id: uuidv4(),
        businessId: businessData.id,
        assetId: uuidv4(),
        name: "Wheat",
        quantity: 5,
        productionTime: 120, // Custom production time
      };

      businessData.outputs = [output];
      const business = new Business(businessData);

      // With custom 120s time and 2.0x rate = 60s effective
      // With 120s accumulated time, should get 2 cycles
      const result = business.calculateAvailableOutputs(120);

      expect(result[0].cyclesCompleted).toBe(2);
      expect(result[0].quantityAvailable).toBe(10);
    });

    it("should handle multiple outputs", () => {
      const output1: BusinessOutputDto = {
        id: uuidv4(),
        businessId: businessData.id,
        assetId: uuidv4(),
        name: "Wheat",
        quantity: 5,
        productionTime: 60,
      };

      const output2: BusinessOutputDto = {
        id: uuidv4(),
        businessId: businessData.id,
        assetId: uuidv4(),
        name: "Corn",
        quantity: 3,
        productionTime: 90,
      };

      businessData.outputs = [output1, output2];
      const business = new Business(businessData);

      const result = business.calculateAvailableOutputs(180);

      expect(result).toHaveLength(2);
      // Output1: 180 / (60/2.0) = 180 / 30 = 6 cycles
      expect(result[0].cyclesCompleted).toBe(6);
      expect(result[0].quantityAvailable).toBe(30);
      // Output2: 180 / (90/2.0) = 180 / 45 = 4 cycles
      expect(result[1].cyclesCompleted).toBe(4);
      expect(result[1].quantityAvailable).toBe(12);
    });
  });

  describe("validateClaim", () => {
    it("should call strategy validateClaim if available", async () => {
      const mockStrategy: IBusinessStrategy = {
        validateClaim: jest.fn().mockResolvedValue(undefined),
      };

      const business = new Business(businessData, mockStrategy);

      await business.validateClaim("output-id", 5);

      expect(mockStrategy.validateClaim).toHaveBeenCalledWith(
        business,
        "output-id",
        5
      );
    });

    it("should not throw if no strategy provided", async () => {
      const business = new Business(businessData);

      await expect(
        business.validateClaim("output-id", 5)
      ).resolves.not.toThrow();
    });
  });

  describe("validateInputs", () => {
    it("should call strategy validateInputs if available", async () => {
      const mockStrategy: IBusinessStrategy = {
        validateInputs: jest.fn().mockResolvedValue(undefined),
      };

      const input: BusinessInputDto = {
        businessId: businessData.id,
        assetId: uuidv4(),
        name: "Water",
        quantity: 10,
      };

      businessData.inputs = [input];
      const business = new Business(businessData, mockStrategy);

      await business.validateInputs([input], 2);

      expect(mockStrategy.validateInputs).toHaveBeenCalledWith(
        business,
        [input],
        2
      );
    });
  });

  describe("getStatus", () => {
    it("should return status with business information", async () => {
      const business = new Business(businessData);

      const status = await business.getStatus();

      expect(status.type).toBe("agriculture");
      expect(status.businessId).toBe(businessData.id);
      expect(status.status).toBe("active");
      expect(status.displayName).toBe("Agriculture");
      expect(status.description).toBeDefined();
      expect(status.category).toBe("producer");
      expect(status.productionRate).toBe(2.0);
      expect(status.defaultProductionTime).toBe(60);
    });

    it("should include strategy status if available", async () => {
      const mockStrategy: IBusinessStrategy = {
        getStatus: jest.fn().mockResolvedValue({
          customField: "customValue",
        }),
      };

      const business = new Business(businessData, mockStrategy);

      const status = await business.getStatus();

      expect(status.customField).toBe("customValue");
      expect(mockStrategy.getStatus).toHaveBeenCalledWith(business);
    });

    it("should include inputs and outputs in status", async () => {
      const input: BusinessInputDto = {
        businessId: businessData.id,
        assetId: uuidv4(),
        name: "Water",
        quantity: 10,
      };

      const output: BusinessOutputDto = {
        businessId: businessData.id,
        assetId: uuidv4(),
        name: "Wheat",
        quantity: 5,
        productionTime: 60,
      };

      businessData.inputs = [input];
      businessData.outputs = [output];

      const business = new Business(businessData);
      const status = await business.getStatus();

      expect(status.inputs).toHaveLength(1);
      expect(status.outputs).toHaveLength(1);
      expect(status.inputs[0].assetId).toBe(input.assetId);
      expect(status.outputs[0].assetId).toBe(output.assetId);
    });
  });

  describe("different business types", () => {
    it("should have correct config for mining", () => {
      const miningData: BusinessDto = {
        ...businessData,
        category: "mining",
      };

      const business = new Business(miningData);

      expect(business.getBaseProductionRate()).toBe(1.5);
      expect(business.getDefaultProductionTime()).toBe(120);
    });

    it("should have correct config for heavy industry", () => {
      const heavyIndustryData: BusinessDto = {
        ...businessData,
        category: "heavy_industry",
      };

      const business = new Business(heavyIndustryData);

      expect(business.getBaseProductionRate()).toBe(0.5);
      expect(business.getDefaultProductionTime()).toBe(1800);
    });

    it("should have correct config for commerce", () => {
      const commerceData: BusinessDto = {
        ...businessData,
        category: "commerce",
      };

      const business = new Business(commerceData);

      expect(business.getBaseProductionRate()).toBe(1.8);
      expect(business.getDefaultProductionTime()).toBe(90);
    });
  });
});

