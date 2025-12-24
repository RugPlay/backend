import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { BusinessDao } from "../daos/business.dao";
import { BusinessInputDao } from "../daos/business-input.dao";
import { BusinessOutputDao } from "../daos/business-output.dao";
import { BusinessProductionDao } from "../daos/business-production.dao";
import { CorporationDao } from "@/modules/corporations/daos/corporation.dao";
import { AssetHoldingDao } from "@/modules/assets/daos/asset-holding.dao";
import { BusinessFactory } from "../factories/business-factory";
import { Business } from "../classes/business.class";
import { CreateBusinessDto } from "../dtos/create-business.dto";
import { UpdateBusinessDto } from "../dtos/update-business.dto";
import { BusinessFiltersDto } from "../dtos/business-filters.dto";
import { BusinessDto } from "../dtos/business.dto";
import { BusinessType } from "../types/business-type";
import { AddProductionTimeDto } from "../dtos/add-production-time.dto";
import { ClaimOutputDto } from "../dtos/claim-output.dto";
import { ClaimOutputResultDto } from "../dtos/claim-output-result.dto";
import { BusinessProductionProgressDto } from "../dtos/business-production-progress.dto";

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    private readonly businessDao: BusinessDao,
    private readonly businessInputDao: BusinessInputDao,
    private readonly businessOutputDao: BusinessOutputDao,
    private readonly businessProductionDao: BusinessProductionDao,
    private readonly corporationDao: CorporationDao,
    private readonly assetHoldingDao: AssetHoldingDao,
    private readonly businessFactory: BusinessFactory
  ) {}

  /**
   * Create a new business
   */
  async createBusiness(
    createDto: CreateBusinessDto
  ): Promise<BusinessDto> {
    this.logger.log(`Creating business: ${createDto.name}`);

    // Validate business type is supported
    if (!this.validateBusinessType(createDto.category)) {
      throw new BadRequestException(
        `Unsupported business type: ${createDto.category}. Supported types: ${this.getSupportedBusinessTypes().join(", ")}`
      );
    }

    // Validate corporation exists
    const corporation = await this.corporationDao.getCorporationById(
      createDto.corporationId
    );
    if (!corporation) {
      throw new NotFoundException(
        `Corporation with ID ${createDto.corporationId} not found`
      );
    }

    // Check if business with same name already exists
    const existing = await this.businessDao.getBusinessByName(createDto.name);
    if (existing) {
      throw new BadRequestException(
        `Business with name ${createDto.name} already exists`
      );
    }

    const businessId = await this.businessDao.createBusiness(createDto);
    if (!businessId) {
      throw new BadRequestException("Failed to create business");
    }

    // Create inputs if provided
    if (createDto.inputs && createDto.inputs.length > 0) {
      for (const input of createDto.inputs) {
        await this.businessInputDao.createInput(businessId, input);
      }
    }

    // Create outputs if provided
    if (createDto.outputs && createDto.outputs.length > 0) {
      for (const output of createDto.outputs) {
        await this.businessOutputDao.createOutput(businessId, output);
      }
    }

    const business = await this.businessDao.getBusinessById(businessId);
    if (!business) {
      throw new NotFoundException("Business not found after creation");
    }

    return business;
  }

  /**
   * Get a business by ID
   */
  async getBusinessById(id: string): Promise<BusinessDto> {
    const business = await this.businessDao.getBusinessById(id);
    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }
    return business;
  }

  /**
   * Get a business by name
   */
  async getBusinessByName(name: string): Promise<BusinessDto> {
    const business = await this.businessDao.getBusinessByName(name);
    if (!business) {
      throw new NotFoundException(`Business with name ${name} not found`);
    }
    return business;
  }

  /**
   * Get all businesses with optional filters
   */
  async getBusinesses(
    filters?: BusinessFiltersDto
  ): Promise<BusinessDto[]> {
    return this.businessDao.getBusinesses(filters);
  }

  /**
   * Get all active businesses
   */
  async getActiveBusinesses(): Promise<BusinessDto[]> {
    return this.businessDao.getActiveBusinesses();
  }

  /**
   * Update a business
   */
  async updateBusiness(
    id: string,
    updateDto: UpdateBusinessDto
  ): Promise<BusinessDto> {
    this.logger.log(`Updating business: ${id}`);

    // Check if business exists
    const existing = await this.businessDao.getBusinessById(id);
    if (!existing) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    // If updating corporation, validate it exists
    if (updateDto.corporationId && updateDto.corporationId !== existing.corporationId) {
      const corporation = await this.corporationDao.getCorporationById(
        updateDto.corporationId
      );
      if (!corporation) {
        throw new NotFoundException(
          `Corporation with ID ${updateDto.corporationId} not found`
        );
      }
    }

    // If updating name, check for conflicts
    if (updateDto.name && updateDto.name !== existing.name) {
      const nameConflict = await this.businessDao.getBusinessByName(
        updateDto.name
      );
      if (nameConflict && nameConflict.id !== id) {
        throw new BadRequestException(
          `Business with name ${updateDto.name} already exists`
        );
      }
    }

    const success = await this.businessDao.updateBusiness(id, updateDto);
    if (!success) {
      throw new BadRequestException("Failed to update business");
    }

    const updated = await this.businessDao.getBusinessById(id);
    if (!updated) {
      throw new NotFoundException("Business not found after update");
    }

    return updated;
  }

  /**
   * Delete a business
   */
  async deleteBusiness(id: string): Promise<void> {
    this.logger.log(`Deleting business: ${id}`);

    const existing = await this.businessDao.getBusinessById(id);
    if (!existing) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    const success = await this.businessDao.deleteBusiness(id);
    if (!success) {
      throw new BadRequestException("Failed to delete business");
    }
  }

  /**
   * Get a business instance by ID
   * Returns a Business instance with type-specific configuration
   */
  async getBusinessInstance(id: string): Promise<Business> {
    const business = await this.getBusinessById(id);
    return this.businessFactory.createBusiness(business);
  }

  /**
   * Get a business instance from business data
   */
  getBusinessInstanceFromData(businessData: BusinessDto): Business {
    return this.businessFactory.createBusiness(businessData);
  }

  /**
   * Validate that a business type is supported
   */
  validateBusinessType(type: string): type is BusinessType {
    return this.businessFactory.isSupportedType(type);
  }

  /**
   * Get all supported business types
   */
  getSupportedBusinessTypes(): BusinessType[] {
    return this.businessFactory.getSupportedTypes();
  }

  /**
   * Add production time to a business
   */
  async addProductionTime(
    businessId: string,
    addTimeDto: AddProductionTimeDto
  ): Promise<BusinessProductionProgressDto> {
    this.logger.log(
      `Adding ${addTimeDto.timeSeconds}s production time to business ${businessId}`
    );

    const business = await this.businessDao.getBusinessById(businessId);
    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    const success = await this.businessProductionDao.addTime(
      businessId,
      addTimeDto.timeSeconds
    );
    if (!success) {
      throw new BadRequestException("Failed to add production time");
    }

    return await this.getProductionProgress(businessId);
  }

  /**
   * Get production progress for a business
   */
  async getProductionProgress(
    businessId: string
  ): Promise<BusinessProductionProgressDto> {
    const business = await this.businessDao.getBusinessById(businessId);
    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    const accumulatedTime =
      await this.businessProductionDao.getAccumulatedTime(businessId);
    const specializedBusiness =
      this.businessFactory.createBusiness(business);

    const availableOutputs = specializedBusiness.calculateAvailableOutputs(
      accumulatedTime
    );

    return {
      businessId,
      accumulatedTime,
      availableOutputs,
      lastUpdated: new Date(),
    };
  }

  /**
   * Claim business outputs
   * Consumes inputs from corporation holdings and adds outputs to corporation holdings
   * 
   * For Commerce businesses: Outputs are cash (USD asset) added to holdings
   * For Power businesses: Outputs are power capacity units (abstracted)
   * For Logistics businesses: Outputs are logistics capacity units (abstracted)
   * For other businesses: Outputs are tradable goods added to holdings
   * 
   * Note: Power multipliers and logistics capacity constraints should be
   * applied at the game loop level, not in this method. This method handles the
   * basic production flow: consume inputs → produce outputs.
   */
  async claimOutput(
    businessId: string,
    claimDto: ClaimOutputDto
  ): Promise<ClaimOutputResultDto> {
    this.logger.log(
      `Claiming output ${claimDto.outputId} from business ${businessId}`
    );

    const business = await this.businessDao.getBusinessById(businessId);
    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    // Find the output
    const output = business.outputs?.find((o) => o.id === claimDto.outputId);
    if (!output) {
      throw new NotFoundException(
        `Output with ID ${claimDto.outputId} not found for this business`
      );
    }

    const businessInstance =
      this.businessFactory.createBusiness(business);
    const accumulatedTime =
      await this.businessProductionDao.getAccumulatedTime(businessId);

    // Validate using strategy if available
    await businessInstance.validateClaim(claimDto.outputId, 0); // Will be validated with actual cycles below

    // Calculate how many cycles are available
    // Use output-specific production time, or default for this business type
    const defaultTime = businessInstance.getDefaultProductionTime();
    const productionTime = output.productionTime || defaultTime;
    
    // Apply business-type-specific production rate multiplier
    // Higher rate = faster production = less time per cycle
    const baseRate = businessInstance.getBaseProductionRate();
    const effectiveTime = productionTime / baseRate;
    
    const maxCycles = Math.floor(accumulatedTime / effectiveTime);
    const cyclesToClaim = claimDto.cycles || maxCycles;

    if (cyclesToClaim > maxCycles) {
      throw new BadRequestException(
        `Cannot claim ${cyclesToClaim} cycles. Only ${maxCycles} cycles available.`
      );
    }

    if (cyclesToClaim <= 0) {
      throw new BadRequestException("Must claim at least 1 cycle");
    }

    // Validate inputs using strategy if available, then standard validation
    const inputs = business.inputs || [];
    if (inputs.length > 0) {
      await businessInstance.validateInputs(inputs, cyclesToClaim);
      
      // Standard input validation
      for (const input of inputs) {
        const requiredQuantity = input.quantity * cyclesToClaim;
        const holding = await this.assetHoldingDao.getAsset(
          business.corporationId,
          input.assetId
        );

        if (!holding || holding.quantity < requiredQuantity) {
          throw new BadRequestException(
            `Insufficient ${input.name || input.assetId}: need ${requiredQuantity}, have ${holding?.quantity || 0}`
          );
        }
      }
    }
    
    // Final validation with actual cycles
    await businessInstance.validateClaim(claimDto.outputId, cyclesToClaim);

    // Consume inputs
    for (const input of inputs) {
      const requiredQuantity = input.quantity * cyclesToClaim;
      const success = await this.assetHoldingDao.adjustAssetQuantity(
        business.corporationId,
        input.assetId,
        -requiredQuantity
      );
      if (!success) {
        throw new BadRequestException(
          `Failed to consume input ${input.name || input.assetId}`
        );
      }
    }

    // Add outputs to corporation holdings
    // For Commerce: output.assetId should be the cash asset (e.g., USD)
    // For Power/Logistics: output.assetId should be the capacity asset
    // For others: output.assetId is the produced good
    const outputQuantity = cyclesToClaim * output.quantity;
    
    // TODO: Apply power multiplier if business type supports it
    // const powerMultiplier = await this.calculatePowerMultiplier(business.corporationId);
    // const adjustedQuantity = outputQuantity * powerMultiplier;
    
    // TODO: Check logistics capacity constraint if applicable
    // const logisticsCapacity = await this.getAvailableLogisticsCapacity(business.corporationId);
    // if (outputQuantity > logisticsCapacity) {
    //   throw new BadRequestException(`Insufficient logistics capacity`);
    // }
    
    const success = await this.assetHoldingDao.adjustAssetQuantity(
      business.corporationId,
      output.assetId,
      outputQuantity
    );
    if (!success) {
      throw new BadRequestException(
        `Failed to add output ${output.name || output.assetId} to holdings`
      );
    }

    // Consume the time (using effective time that accounts for production rate)
    const timeToConsume = cyclesToClaim * effectiveTime;
    await this.businessProductionDao.consumeTime(businessId, timeToConsume);

    const quantity = cyclesToClaim * output.quantity;

    return {
      assetId: output.assetId,
      quantity,
      cyclesClaimed: cyclesToClaim,
      remainingTime: accumulatedTime - timeToConsume,
    };
  }
}

