import { Injectable } from "@nestjs/common";
import { BusinessDto } from "../dtos/business.dto";
import { Business } from "../classes/business.class";
import { BusinessType } from "../types/business-type";
import { isSupportedBusinessType, getSupportedBusinessTypes } from "../config/business-type-config";
import { SpecialBusinessStrategies } from "../strategies/special-business-strategies";

/**
 * Factory class for creating business instances
 * Uses configuration-driven approach with optional strategies for special behaviors
 */
@Injectable()
export class BusinessFactory {
  constructor(
    private readonly specialStrategies: SpecialBusinessStrategies,
  ) {}

  /**
   * Create a business instance based on the business type
   * Uses configuration for standard behavior, strategies for special cases
   */
  createBusiness(businessData: BusinessDto): Business {
    const businessType = businessData.category as BusinessType;

    if (!isSupportedBusinessType(businessType)) {
      throw new Error(
        `Unsupported business type: ${businessType}. Supported types: ${getSupportedBusinessTypes().join(", ")}`
      );
    }

    // Get strategy if one exists for this business type
    const strategy = this.specialStrategies.getStrategy(businessType);

    return new Business(businessData, strategy || undefined);
  }

  /**
   * Check if a business type is supported
   */
  isSupportedType(type: string): type is BusinessType {
    return isSupportedBusinessType(type);
  }

  /**
   * Get all supported business types
   */
  getSupportedTypes(): BusinessType[] {
    return getSupportedBusinessTypes();
  }
}

