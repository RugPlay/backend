import { Injectable } from "@nestjs/common";
import { BusinessType } from "../types/business-type";
import { IBusinessStrategy } from "./business-strategy.interface";
import { Business } from "../classes/business.class";
import { BusinessInputDto } from "../dtos/business-input.dto";

/**
 * Registry for special business strategies
 * Most businesses use standard behavior (no strategy needed)
 * Only businesses with special requirements need strategies here
 */
@Injectable()
export class SpecialBusinessStrategies {
  private strategies: Map<BusinessType, IBusinessStrategy> = new Map();

  constructor() {
    // Register special strategies here
    // For now, no special strategies are needed
    // Add them here when special behaviors are required:
    //
    // this.strategies.set("commerce", new CommerceStrategy());
    // this.strategies.set("power", new PowerStrategy());
  }

  /**
   * Get strategy for a business type, if one exists
   */
  getStrategy(type: BusinessType): IBusinessStrategy | null {
    return this.strategies.get(type) || null;
  }

  /**
   * Register a strategy for a business type
   */
  registerStrategy(type: BusinessType, strategy: IBusinessStrategy): void {
    this.strategies.set(type, strategy);
  }

  /**
   * Check if a business type has a special strategy
   */
  hasStrategy(type: BusinessType): boolean {
    return this.strategies.has(type);
  }
}

