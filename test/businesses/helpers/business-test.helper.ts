import { BusinessService } from "../../../src/modules/businesses/services/business.service";
import { AssetService } from "../../../src/modules/assets/services/asset.service";
import { CreateBusinessDto } from "../../../src/modules/businesses/dtos/create-business.dto";
import { BusinessDto } from "../../../src/modules/businesses/dtos/business.dto";
import { BusinessType } from "../../../src/modules/businesses/types/business-type";

/**
 * Test helper utilities for business module tests
 */
export class BusinessTestHelper {
  /**
   * Create a test business with default values
   */
  static async createTestBusiness(
    businessService: BusinessService,
    corporationId: string,
    overrides?: Partial<CreateBusinessDto>
  ): Promise<BusinessDto> {
    return businessService.createBusiness({
      name: `Test Business ${Date.now()}`,
      category: "agriculture",
      corporationId,
      isActive: true,
      ...overrides,
    });
  }

  /**
   * Create a test business with inputs and outputs
   */
  static async createTestBusinessWithIO(
    businessService: BusinessService,
    assetService: AssetService,
    corporationId: string,
    category: BusinessType
  ): Promise<{ business: BusinessDto; inputAssetId: string; outputAssetId: string }> {
    // Create test assets - use shorter symbols to fit varchar(20) limit
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits
    const inputAsset = await assetService.createAsset({
      symbol: `IN${timestamp}`,
      name: "Input Asset",
      type: "commodity",
    });

    const outputAsset = await assetService.createAsset({
      symbol: `OUT${timestamp}`,
      name: "Output Asset",
      type: "commodity",
    });

    const business = await businessService.createBusiness({
      name: `Test ${category} Business`,
      category,
      corporationId,
      inputs: [
        {
          assetId: inputAsset.id,
          quantity: 10,
        },
      ],
      outputs: [
        {
          assetId: outputAsset.id,
          quantity: 5,
          productionTime: 60,
        },
      ],
    });

    return {
      business,
      inputAssetId: inputAsset.id,
      outputAssetId: outputAsset.id,
    };
  }

  /**
   * Create a test agriculture business with wheat output
   */
  static async createTestAgricultureBusiness(
    businessService: BusinessService,
    assetService: AssetService,
    corporationId: string
  ): Promise<{ business: BusinessDto; wheatAssetId: string }> {
    // Use shorter symbol to fit varchar(20) limit - max 20 chars
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits
    const wheatAsset = await assetService.createAsset({
      symbol: `WHT${timestamp}`,
      name: "Wheat",
      type: "commodity",
    });

    const business = await businessService.createBusiness({
      name: `Test Farm ${Date.now()}`,
      category: "agriculture",
      corporationId,
      outputs: [
        {
          assetId: wheatAsset.id,
          quantity: 5,
          productionTime: 60,
        },
      ],
    });

    return {
      business,
      wheatAssetId: wheatAsset.id,
    };
  }

  /**
   * Create a test manufacturing business with inputs and outputs
   */
  static async createTestManufacturingBusiness(
    businessService: BusinessService,
    assetService: AssetService,
    corporationId: string,
    wheatAssetId: string,
    ironAssetId: string
  ): Promise<{ business: BusinessDto; manufacturedGoodsAssetId: string }> {
    // Use shorter symbol to fit varchar(20) limit - max 20 chars
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits
    const manufacturedGoodsAsset = await assetService.createAsset({
      symbol: `MFG${timestamp}`,
      name: "Manufactured Goods",
      type: "commodity",
    });

    const business = await businessService.createBusiness({
      name: `Test Factory ${Date.now()}`,
      category: "industry_manufacturing",
      corporationId,
      inputs: [
        {
          assetId: wheatAssetId,
          quantity: 2,
        },
        {
          assetId: ironAssetId,
          quantity: 1,
        },
      ],
      outputs: [
        {
          assetId: manufacturedGoodsAsset.id,
          quantity: 1,
          productionTime: 300,
        },
      ],
    });

    return {
      business,
      manufacturedGoodsAssetId: manufacturedGoodsAsset.id,
    };
  }
}

