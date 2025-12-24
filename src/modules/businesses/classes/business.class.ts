import { BusinessDto } from "../dtos/business.dto";
import { BusinessInputDto } from "../dtos/business-input.dto";
import { BusinessOutputDto } from "../dtos/business-output.dto";
import { BusinessTypeConfig, getBusinessTypeConfig } from "../config/business-type-config";
import { BusinessType } from "../types/business-type";
import { IBusinessStrategy } from "../strategies/business-strategy.interface";

/**
 * Unified Business class that replaces all specialized business classes
 * Uses configuration-driven approach with optional strategies for special behaviors
 */
export class Business {
  protected businessData: BusinessDto;
  protected config: BusinessTypeConfig;
  protected strategy?: IBusinessStrategy;

  constructor(
    businessData: BusinessDto,
    strategy?: IBusinessStrategy,
  ) {
    this.businessData = businessData;
    const type = businessData.category as BusinessType;
    this.config = getBusinessTypeConfig(type);
    this.strategy = strategy;
  }

  /**
   * Get the business ID
   */
  getId(): string {
    return this.businessData.id;
  }

  /**
   * Get the business name
   */
  getName(): string {
    return this.businessData.name;
  }

  /**
   * Get the business category/type
   */
  getType(): string {
    return this.businessData.category;
  }

  /**
   * Get the corporation ID that owns this business
   */
  getCorporationId(): string {
    return this.businessData.corporationId;
  }

  /**
   * Check if the business is active
   */
  isActive(): boolean {
    return this.businessData.isActive;
  }

  /**
   * Get the full business DTO
   */
  getBusinessData(): BusinessDto {
    return this.businessData;
  }

  /**
   * Get all input requirements for this business
   */
  getInputs(): BusinessInputDto[] {
    return this.businessData.inputs || [];
  }

  /**
   * Get all outputs produced by this business
   */
  getOutputs(): BusinessOutputDto[] {
    return this.businessData.outputs || [];
  }

  /**
   * Get the base production rate multiplier for this business type
   * Different business types produce at different rates
   * Returns a multiplier (1.0 = normal, >1.0 = faster, <1.0 = slower)
   */
  getBaseProductionRate(): number {
    return this.config.baseProductionRate;
  }

  /**
   * Get the default production time (in seconds) for outputs if not specified
   * Different business types have different default cycle times
   */
  getDefaultProductionTime(): number {
    return this.config.defaultProductionTime;
  }

  /**
   * Get the business type configuration
   */
  getConfig(): BusinessTypeConfig {
    return this.config;
  }

  /**
   * Calculate how many production cycles can be completed with accumulated time
   * Returns array of outputs with their available cycles and quantities
   * Applies business-type-specific production rate multipliers
   */
  calculateAvailableOutputs(
    accumulatedTime: number,
  ): Array<{
    output: BusinessOutputDto;
    cyclesCompleted: number;
    quantityAvailable: number;
  }> {
    const outputs = this.getOutputs();
    const baseRate = this.getBaseProductionRate();
    const defaultTime = this.getDefaultProductionTime();

    return outputs.map((output) => {
      // Use output-specific production time, or default for this business type
      const productionTime = output.productionTime || defaultTime;

      // Apply production rate multiplier: higher rate = more cycles per time unit
      // If rate is 2.0, time is effectively halved (produces twice as fast)
      const effectiveTime = productionTime / baseRate;
      const cyclesCompleted = Math.floor(accumulatedTime / effectiveTime);
      const quantityAvailable = cyclesCompleted * output.quantity;

      return {
        output,
        cyclesCompleted,
        quantityAvailable,
      };
    });
  }

  /**
   * Validate claim using strategy if available, otherwise use standard validation
   */
  async validateClaim(outputId: string, cycles: number): Promise<void> {
    if (this.strategy?.validateClaim) {
      await this.strategy.validateClaim(this, outputId, cycles);
    }
    // Standard validation continues in service layer
  }

  /**
   * Validate inputs using strategy if available
   */
  async validateInputs(inputs: BusinessInputDto[], cycles: number): Promise<void> {
    if (this.strategy?.validateInputs) {
      await this.strategy.validateInputs(this, inputs, cycles);
    }
    // Standard validation continues in service layer
  }

  /**
   * Get business-specific status or metrics
   */
  async getStatus(): Promise<any> {
    const baseStatus = {
      type: this.getType(),
      businessId: this.getId(),
      status: this.isActive() ? "active" : "inactive",
      displayName: this.config.displayName,
      description: this.config.description,
      category: this.config.category,
      inputs: this.getInputs().map((i) => ({
        assetId: i.assetId,
        name: i.name,
        requiredQuantity: i.quantity,
      })),
      outputs: this.getOutputs().map((o) => ({
        assetId: o.assetId,
        name: o.name,
        producedQuantity: o.quantity,
        productionTime: o.productionTime,
      })),
      productionRate: this.getBaseProductionRate(),
      defaultProductionTime: this.getDefaultProductionTime(),
    };

    // Add strategy-specific status if available
    if (this.strategy?.getStatus) {
      const strategyStatus = await this.strategy.getStatus(this);
      return { ...baseStatus, ...strategyStatus };
    }

    return baseStatus;
  }
}

