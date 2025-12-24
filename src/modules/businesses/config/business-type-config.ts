import { BusinessType } from "../types/business-type";

/**
 * Configuration for business type behavior
 */
export interface BusinessTypeConfig {
  baseProductionRate: number;
  defaultProductionTime: number;
  displayName: string;
  description: string;
  category: "producer" | "processor" | "utility" | "service";
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
  },
  mining: {
    baseProductionRate: 1.5,
    defaultProductionTime: 120, // 2 minutes
    displayName: "Mining",
    description: "Extracts ores and raw materials",
    category: "producer",
  },
  industry_manufacturing: {
    baseProductionRate: 1.0,
    defaultProductionTime: 300, // 5 minutes
    displayName: "Manufacturing",
    description: "Converts raw materials into manufactured goods",
    category: "processor",
  },
  industry_technology: {
    baseProductionRate: 0.8,
    defaultProductionTime: 600, // 10 minutes
    displayName: "Technology",
    description: "Produces electronics and technology products",
    category: "processor",
  },
  industry_healthcare: {
    baseProductionRate: 0.75,
    defaultProductionTime: 720, // 12 minutes
    displayName: "Healthcare",
    description: "Produces medical supplies and healthcare products",
    category: "processor",
  },
  heavy_industry: {
    baseProductionRate: 0.5,
    defaultProductionTime: 1800, // 30 minutes
    displayName: "Heavy Industry",
    description: "Produces fuel and heavy industrial materials",
    category: "processor",
  },
  power: {
    baseProductionRate: 1.2,
    defaultProductionTime: 240, // 4 minutes
    displayName: "Power",
    description: "Generates power capacity that multiplies other businesses",
    category: "utility",
  },
  logistics: {
    baseProductionRate: 1.3,
    defaultProductionTime: 180, // 3 minutes
    displayName: "Logistics",
    description: "Provides transportation and distribution capacity",
    category: "service",
  },
  commerce: {
    baseProductionRate: 1.8,
    defaultProductionTime: 90, // 1.5 minutes
    displayName: "Commerce",
    description: "Converts goods to cash via population sales",
    category: "service",
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

