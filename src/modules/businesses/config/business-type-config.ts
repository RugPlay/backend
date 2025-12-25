import { BusinessType } from "../types/business-type";

/**
 * Recipe item for inputs or outputs
 * Uses asset symbols that will be resolved to asset IDs
 */
export interface RecipeItem {
  assetSymbol: string;
  assetName: string;
  quantity: number;
  productionTime?: number; // Only for outputs
}

/**
 * Recipe definition for a business type
 */
export interface BusinessRecipe {
  inputs?: RecipeItem[];
  outputs: RecipeItem[];
}

/**
 * Configuration for business type behavior
 */
export interface BusinessTypeConfig {
  baseProductionRate: number;
  defaultProductionTime: number;
  displayName: string;
  description: string;
  category: "producer" | "processor" | "utility" | "service";
  recipe: BusinessRecipe;
}

/**
 * Business type configuration registry
 * All business types are defined here with their production characteristics
 */
export const BUSINESS_TYPE_CONFIG: Record<BusinessType, BusinessTypeConfig> = {
  agriculture: {
    baseProductionRate: 2.0,
    defaultProductionTime: 60, // 1 minute
    displayName: "Agriculture",
    description: "Produces crops and agricultural goods",
    category: "producer",
    recipe: {
      outputs: [
        {
          assetSymbol: "WHEAT",
          assetName: "Wheat",
          quantity: 5,
          productionTime: 60,
        },
      ],
    },
  },
  mining: {
    baseProductionRate: 1.5,
    defaultProductionTime: 120, // 2 minutes
    displayName: "Mining",
    description: "Extracts ores and raw materials",
    category: "producer",
    recipe: {
      outputs: [
        {
          assetSymbol: "IRON",
          assetName: "Iron Ore",
          quantity: 2,
          productionTime: 120,
        },
      ],
    },
  },
  industry_manufacturing: {
    baseProductionRate: 1.0,
    defaultProductionTime: 300, // 5 minutes
    displayName: "Manufacturing",
    description: "Converts raw materials into manufactured goods",
    category: "processor",
    recipe: {
      inputs: [
        {
          assetSymbol: "WHEAT",
          assetName: "Wheat",
          quantity: 2,
        },
        {
          assetSymbol: "IRON",
          assetName: "Iron Ore",
          quantity: 1,
        },
      ],
      outputs: [
        {
          assetSymbol: "MFG_GOODS",
          assetName: "Manufactured Goods",
          quantity: 1,
          productionTime: 300,
        },
      ],
    },
  },
  industry_technology: {
    baseProductionRate: 0.8,
    defaultProductionTime: 600, // 10 minutes
    displayName: "Technology",
    description: "Produces electronics and technology products",
    category: "processor",
    recipe: {
      inputs: [
        {
          assetSymbol: "COPPER",
          assetName: "Copper",
          quantity: 1,
        },
        {
          assetSymbol: "NICKEL",
          assetName: "Nickel",
          quantity: 1,
        },
        {
          assetSymbol: "MFG_GOODS",
          assetName: "Manufactured Goods",
          quantity: 1,
        },
      ],
      outputs: [
        {
          assetSymbol: "ELECTRONICS",
          assetName: "Electronics",
          quantity: 1,
          productionTime: 600,
        },
      ],
    },
  },
  industry_healthcare: {
    baseProductionRate: 0.75,
    defaultProductionTime: 720, // 12 minutes
    displayName: "Healthcare",
    description: "Produces medical supplies and healthcare products",
    category: "processor",
    recipe: {
      inputs: [
        {
          assetSymbol: "CHEMICALS",
          assetName: "Chemicals",
          quantity: 1,
        },
        {
          assetSymbol: "ELECTRONICS",
          assetName: "Electronics",
          quantity: 1,
        },
      ],
      outputs: [
        {
          assetSymbol: "MEDICAL",
          assetName: "Medical Supplies",
          quantity: 1,
          productionTime: 720,
        },
      ],
    },
  },
  heavy_industry: {
    baseProductionRate: 0.5,
    defaultProductionTime: 1800, // 30 minutes
    displayName: "Heavy Industry",
    description: "Produces fuel and heavy industrial materials",
    category: "processor",
    recipe: {
      inputs: [
        {
          assetSymbol: "IRON",
          assetName: "Iron Ore",
          quantity: 2,
        },
      ],
      outputs: [
        {
          assetSymbol: "OIL",
          assetName: "Oil",
          quantity: 1,
          productionTime: 1800,
        },
        {
          assetSymbol: "GAS",
          assetName: "Natural Gas",
          quantity: 1,
          productionTime: 1800,
        },
      ],
    },
  },
  power: {
    baseProductionRate: 1.2,
    defaultProductionTime: 240, // 4 minutes
    displayName: "Power",
    description: "Generates power capacity that multiplies other businesses",
    category: "utility",
    recipe: {
      inputs: [
        {
          assetSymbol: "OIL",
          assetName: "Oil",
          quantity: 1,
        },
      ],
      outputs: [
        {
          assetSymbol: "POWER",
          assetName: "Power Capacity",
          quantity: 20,
          productionTime: 240,
        },
      ],
    },
  },
  logistics: {
    baseProductionRate: 1.3,
    defaultProductionTime: 180, // 3 minutes
    displayName: "Logistics",
    description: "Provides transportation and distribution capacity",
    category: "service",
    recipe: {
      inputs: [
        {
          assetSymbol: "OIL",
          assetName: "Oil",
          quantity: 0.5,
        },
      ],
      outputs: [
        {
          assetSymbol: "LOGISTICS",
          assetName: "Logistics Capacity",
          quantity: 5,
          productionTime: 180,
        },
      ],
    },
  },
  commerce: {
    baseProductionRate: 1.8,
    defaultProductionTime: 90, // 1.5 minutes
    displayName: "Commerce",
    description: "Converts goods to cash via population sales",
    category: "service",
    recipe: {
      inputs: [
        {
          assetSymbol: "MFG_GOODS",
          assetName: "Manufactured Goods",
          quantity: 1,
        },
      ],
      outputs: [
        {
          assetSymbol: "USD",
          assetName: "US Dollar",
          quantity: 20, // Base amount, can be dynamic based on demand
          productionTime: 90,
        },
      ],
    },
  },
};

/**
 * Get configuration for a business type
 */
export function getBusinessTypeConfig(type: BusinessType): BusinessTypeConfig {
  const config = BUSINESS_TYPE_CONFIG[type];
  if (!config) {
    throw new Error(`No configuration found for business type: ${type}`);
  }
  return config;
}

/**
 * Get all supported business types
 */
export function getSupportedBusinessTypes(): BusinessType[] {
  return Object.keys(BUSINESS_TYPE_CONFIG) as BusinessType[];
}

/**
 * Check if a business type is supported
 */
export function isSupportedBusinessType(type: string): type is BusinessType {
  return type in BUSINESS_TYPE_CONFIG;
}

