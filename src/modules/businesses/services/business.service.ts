import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { BusinessDao } from "../daos/business.dao";
import { ProductionDao, Production } from "../daos/production.dao";
import { CorporationDao } from "@/modules/corporations/daos/corporation.dao";
import { AssetHoldingDao } from "@/modules/assets/daos/asset-holding.dao";
import { AssetService } from "@/modules/assets/services/asset.service";
import { BusinessFactory } from "../factories/business-factory";
import { Business } from "../classes/business.class";
import { CreateBusinessDto } from "../dtos/create-business.dto";
import { UpdateBusinessDto } from "../dtos/update-business.dto";
import { BusinessFiltersDto } from "../dtos/business-filters.dto";
import { BusinessDto } from "../dtos/business.dto";
import { BusinessType } from "../types/business-type";
import { AddProductionInputsDto } from "../dtos/add-production-inputs.dto";
import { ClaimOutputDto } from "../dtos/claim-output.dto";
import { ClaimOutputResultDto } from "../dtos/claim-output-result.dto";
import { BusinessProductionProgressDto } from "../dtos/business-production-progress.dto";
import { ProductionBatchDto } from "../dtos/production-batch.dto";
import { getBusinessTypeConfig } from "../config/business-type-config";
import { BusinessInputDto } from "../dtos/business-input.dto";

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    private readonly businessDao: BusinessDao,
    private readonly productionDao: ProductionDao,
    private readonly corporationDao: CorporationDao,
    private readonly assetHoldingDao: AssetHoldingDao,
    private readonly assetService: AssetService,
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

    // Inputs and outputs are now derived from recipes in BusinessDao
    // No need to create them in the database
    
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
   * Add production inputs to start a new production batch
   * Calculates cycles from inputs and starts real-time production
   */
  async addProductionInputs(
    businessId: string,
    inputsDto: AddProductionInputsDto
  ): Promise<BusinessProductionProgressDto> {
    this.logger.log(
      `Adding production inputs to business ${businessId}`
    );

    const business = await this.businessDao.getBusinessById(businessId);
    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    const businessInstance = this.businessFactory.createBusiness(business);
    const inputs = business.inputs || [];

    if (inputs.length === 0) {
      throw new BadRequestException("Business has no input requirements defined");
    }

    // Validate all required inputs are provided
    const providedInputMap = new Map(
      inputsDto.inputs.map((input) => [input.assetId, input.quantity])
    );

    for (const requiredInput of inputs) {
      if (!providedInputMap.has(requiredInput.assetId)) {
        throw new BadRequestException(
          `Missing required input: ${requiredInput.name || requiredInput.assetId}`
        );
      }
    }

    // Calculate max cycles from scarcest input
    let maxCycles = Infinity;
    const inputQuantities: Record<string, number> = {};

    for (const requiredInput of inputs) {
      const providedQuantity = providedInputMap.get(requiredInput.assetId)!;
      const cyclesFromInput = Math.floor(providedQuantity / requiredInput.quantity);
      maxCycles = Math.min(maxCycles, cyclesFromInput);
      inputQuantities[requiredInput.assetId] = providedQuantity;
    }

    if (maxCycles <= 0 || maxCycles === Infinity) {
      throw new BadRequestException(
        "Insufficient inputs to create at least 1 production cycle"
      );
    }

    // Validate holdings have enough inputs
    for (const inputItem of inputsDto.inputs) {
      const holding = await this.assetHoldingDao.getAsset(
        business.corporationId,
        inputItem.assetId
      );

      if (!holding || holding.quantity < inputItem.quantity) {
        throw new BadRequestException(
          `Insufficient ${inputItem.assetId}: need ${inputItem.quantity}, have ${holding?.quantity || 0}`
        );
      }
    }

    // Consume inputs from holdings
    for (const inputItem of inputsDto.inputs) {
      const success = await this.assetHoldingDao.adjustAssetQuantity(
        business.corporationId,
        inputItem.assetId,
        -inputItem.quantity
      );
      if (!success) {
        throw new BadRequestException(
          `Failed to consume input ${inputItem.assetId}`
        );
      }
    }

    // Calculate cycle completion time
    const defaultTime = businessInstance.getDefaultProductionTime();
    const baseRate = businessInstance.getBaseProductionRate();
    const cycleCompletionTime = defaultTime / baseRate;

    // Create production batch
    const batchId = await this.productionDao.createBatch(
      businessId,
      maxCycles,
      inputQuantities,
      cycleCompletionTime
    );

    if (!batchId) {
      throw new BadRequestException("Failed to create production batch");
    }

    return await this.getProductionProgress(businessId);
  }

  /**
   * Get production progress for a business (batch-based)
   */
  async getProductionProgress(
    businessId: string
  ): Promise<BusinessProductionProgressDto> {
    const business = await this.businessDao.getBusinessById(businessId);
    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    const businessInstance = this.businessFactory.createBusiness(business);
    const batches = await this.productionDao.getBatchesByBusinessId(businessId);
    
    // Calculate available cycles for each batch (real-time)
    const now = Date.now();
    let totalCyclesAvailable = 0;
    let totalCyclesInProgress = 0;

    const batchDtos: ProductionBatchDto[] = batches.map((batch) => {
      const elapsedSeconds = (now - batch.production_started_at.getTime()) / 1000;
      const cyclesCompleted = Math.floor(elapsedSeconds / batch.cycle_completion_time);
      const cyclesAvailable = Math.min(cyclesCompleted, batch.cycles_remaining);
      
      // Update status if needed
      if (cyclesAvailable >= batch.cycles_remaining && batch.status === "active") {
        // Mark as completed (async, don't wait)
        this.productionDao.markBatchCompleted(batch.id).catch(
          (err) => this.logger.error(`Failed to mark batch ${batch.id} as completed`, err)
        );
      }

      totalCyclesAvailable += cyclesAvailable;
      totalCyclesInProgress += batch.cycles_remaining - cyclesAvailable;

      return {
        id: batch.id,
        cycles: batch.cycles,
        cyclesRemaining: batch.cycles_remaining,
        inputQuantities: batch.input_quantities,
        productionStartedAt: batch.production_started_at,
        cycleCompletionTime: batch.cycle_completion_time,
        status: batch.status,
        cyclesAvailable,
        createdAt: batch.created_at,
        updatedAt: batch.updated_at,
      };
    });

    // Calculate available outputs based on total cycles
    const availableOutputs = business.outputs?.map((output) => {
      const productionTime = output.productionTime || businessInstance.getDefaultProductionTime();
      const baseRate = businessInstance.getBaseProductionRate();
      const effectiveTime = productionTime / baseRate;
      const cyclesCompleted = Math.floor(totalCyclesAvailable);
      const quantityAvailable = cyclesCompleted * output.quantity;

      return {
        output,
        cyclesCompleted,
        quantityAvailable,
      };
    }) || [];

    const lastClaimedAt = await this.businessDao.getLastClaimedAt(businessId);

    return {
      businessId,
      totalCyclesAvailable,
      totalCyclesInProgress,
      batches: batchDtos,
      availableOutputs,
      lastUpdated: new Date(),
      lastClaimedAt: lastClaimedAt || undefined,
    };
  }

  /**
   * Get all production batches for a business (for frontend display)
   */
  async getBusinessProductionBatches(businessId: string): Promise<ProductionBatchDto[]> {
    const business = await this.businessDao.getBusinessById(businessId);
    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    const batches = await this.productionDao.getBatchesByBusinessId(businessId);
    const now = Date.now();

    return batches.map((batch) => {
      const elapsedSeconds = (now - batch.production_started_at.getTime()) / 1000;
      const cyclesCompleted = Math.floor(elapsedSeconds / batch.cycle_completion_time);
      const cyclesAvailable = Math.min(cyclesCompleted, batch.cycles_remaining);

      return {
        id: batch.id,
        cycles: batch.cycles,
        cyclesRemaining: batch.cycles_remaining,
        inputQuantities: batch.input_quantities,
        productionStartedAt: batch.production_started_at,
        cycleCompletionTime: batch.cycle_completion_time,
        status: batch.status,
        cyclesAvailable,
        createdAt: batch.created_at,
        updatedAt: batch.updated_at,
      };
    });
  }

  /**
   * Claim business outputs (batch-based)
   * Consumes cycles from production batches and adds outputs to corporation holdings
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
      `Claiming output ${claimDto.assetId} from business ${businessId}`
    );

    const business = await this.businessDao.getBusinessById(businessId);
    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    // Find the output by assetId (outputs no longer have IDs, they come from recipes)
    const output = business.outputs?.find((o) => o.assetId === claimDto.assetId);
    if (!output) {
      throw new NotFoundException(
        `Output with asset ID ${claimDto.assetId} not found for this business`
      );
    }

    const businessInstance = this.businessFactory.createBusiness(business);
    
    // Get batches with available cycles
    const batches = await this.productionDao.getBatchesWithAvailableCycles(businessId);
    
    // Calculate available cycles from all batches (real-time)
    const now = Date.now();
    let totalCyclesAvailable = 0;
    const batchCycles: Array<{ batch: Production; cyclesAvailable: number }> = [];

    for (const batch of batches) {
      const elapsedSeconds = (now - batch.production_started_at.getTime()) / 1000;
      const cyclesCompleted = Math.floor(elapsedSeconds / batch.cycle_completion_time);
      const cyclesAvailable = Math.min(cyclesCompleted, batch.cycles_remaining);
      
      if (cyclesAvailable > 0) {
        totalCyclesAvailable += cyclesAvailable;
        batchCycles.push({ batch, cyclesAvailable });
      }
    }

    const cyclesToClaim = claimDto.cycles || totalCyclesAvailable;

    if (cyclesToClaim > totalCyclesAvailable) {
      throw new BadRequestException(
        `Cannot claim ${cyclesToClaim} cycles. Only ${totalCyclesAvailable} cycles available.`
      );
    }

    if (cyclesToClaim <= 0) {
      throw new BadRequestException("Must claim at least 1 cycle");
    }

    // Validate using strategy if available
    await businessInstance.validateClaim(claimDto.assetId, cyclesToClaim);

    // Consume cycles from batches (FIFO - oldest first)
    let cyclesRemainingToClaim = cyclesToClaim;
    const inputs = business.inputs || [];

    for (const { batch, cyclesAvailable } of batchCycles) {
      if (cyclesRemainingToClaim <= 0) break;

      const cyclesToConsumeFromBatch = Math.min(cyclesAvailable, cyclesRemainingToClaim);
      
      // Consume inputs from this batch
      for (const input of inputs) {
        const requiredQuantity = input.quantity * cyclesToConsumeFromBatch;
        // Inputs were already consumed when batch was created, so we just update the batch
      }

      // Update batch cycles remaining
      const newCyclesRemaining = batch.cycles_remaining - cyclesToConsumeFromBatch;
      await this.productionDao.updateBatchCycles(batch.id, newCyclesRemaining);

      cyclesRemainingToClaim -= cyclesToConsumeFromBatch;
    }

    // Add outputs to corporation holdings
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

    // Update last claimed timestamp
    await this.businessDao.updateLastClaimedAt(businessId);

    // Calculate remaining cycles
    const progress = await this.getProductionProgress(businessId);

    return {
      assetId: output.assetId,
      quantity: outputQuantity,
      cyclesClaimed: cyclesToClaim,
      remainingTime: progress.totalCyclesAvailable,
    };
  }
}

