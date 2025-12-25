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
   * Note: Inputs and outputs are now created from recipes automatically
   */
  static async createTestBusinessWithIO(
    businessService: BusinessService,
    assetService: AssetService,
    corporationId: string,
    category: BusinessType
  ): Promise<{ business: BusinessDto; inputAssetId: string; outputAssetId: string }> {
    // Create business - inputs/outputs will be created from recipe
    const business = await businessService.createBusiness({
      name: `Test ${category} Business ${Date.now()}`,
      category,
      corporationId,
      // No inputs/outputs - recipe will create them
    });

    // Get the first input and output from the created business
    const inputAssetId = business.inputs && business.inputs.length > 0 
      ? business.inputs[0].assetId 
      : "";
    const outputAssetId = business.outputs && business.outputs.length > 0 
      ? business.outputs[0].assetId 
      : "";

    return {
      business,
      inputAssetId,
      outputAssetId,
    };
  }

  /**
   * Create a test agriculture business with wheat output
   * Outputs are now automatically created from recipe, but we still return the asset ID
   */
  static async createTestAgricultureBusiness(
    businessService: BusinessService,
    assetService: AssetService,
    corporationId: string
  ): Promise<{ business: BusinessDto; wheatAssetId: string }> {
    // Create business - outputs will be created automatically from recipe
    const business = await businessService.createBusiness({
      name: `Test Farm ${Date.now()}`,
      category: "agriculture",
      corporationId,
      // No outputs needed - recipe will create WHEAT output automatically
    });

    // Get the wheat asset ID from the created output
    // The recipe creates a WHEAT asset, so we need to find it
    let wheatAssetId: string;
    if (business.outputs && business.outputs.length > 0) {
      wheatAssetId = business.outputs[0].assetId;
    } else {
      // Fallback: try to get WHEAT asset by symbol
      try {
        const wheatAsset = await assetService.getAssetBySymbol("WHEAT");
        wheatAssetId = wheatAsset.id;
      } catch {
        // If not found, create it (shouldn't happen with recipe system)
        const wheatAsset = await assetService.createAsset({
          symbol: "WHEAT",
          name: "Wheat",
          type: "commodity",
        });
        wheatAssetId = wheatAsset.id;
      }
    }

    return {
      business,
      wheatAssetId,
    };
  }

  /**
   * Create a test manufacturing business with inputs and outputs
   * Inputs and outputs are now automatically created from recipe
   */
  static async createTestManufacturingBusiness(
    businessService: BusinessService,
    assetService: AssetService,
    corporationId: string,
    wheatAssetId: string,
    ironAssetId: string
  ): Promise<{ business: BusinessDto; manufacturedGoodsAssetId: string }> {
    // Create business - inputs and outputs will be created automatically from recipe
    // But we can still pass custom inputs if needed (recipe will use them)
    // Create business - recipe will create inputs (WHEAT, IRON) and output (MFG_GOODS) automatically
    const business = await businessService.createBusiness({
      name: `Test Factory ${Date.now()}`,
      category: "industry_manufacturing",
      corporationId,
      // No inputs/outputs - recipe will create them
    });

    // After creation, we can add custom inputs if needed using addBusinessInput
    // For now, we'll use the recipe inputs

    // Get the manufactured goods asset ID from the created output
    let manufacturedGoodsAssetId: string;
    if (business.outputs && business.outputs.length > 0) {
      manufacturedGoodsAssetId = business.outputs[0].assetId;
    } else {
      // Fallback: try to get MFG_GOODS asset by symbol
      try {
        const mfgAsset = await assetService.getAssetBySymbol("MFG_GOODS");
        manufacturedGoodsAssetId = mfgAsset.id;
      } catch {
        // If not found, create it (shouldn't happen with recipe system)
        const mfgAsset = await assetService.createAsset({
          symbol: "MFG_GOODS",
          name: "Manufactured Goods",
          type: "commodity",
        });
        manufacturedGoodsAssetId = mfgAsset.id;
      }
    }

    return {
      business,
      manufacturedGoodsAssetId,
    };
  }
}

