import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { AssetHoldingDao } from "../daos/asset-holding.dao";
import { CorporationDao } from "@/modules/corporations/daos/corporation.dao";
import { HoldingDto } from "../dtos/holding.dto";
import { CreateHoldingDto } from "../dtos/create-holding.dto";
import { UpdateHoldingDto } from "../dtos/update-holding.dto";

@Injectable()
export class HoldingService {
  private readonly logger = new Logger(HoldingService.name);

  constructor(
    private readonly assetHoldingDao: AssetHoldingDao,
    private readonly corporationDao: CorporationDao,
  ) {}

  /**
   * Get all holdings for a corporation
   */
  async getHoldingsByCorporationId(corporationId: string): Promise<HoldingDto[]> {
    this.logger.log(`Getting holdings for corporation: ${corporationId}`);
    
    // Validate corporation exists
    const corporation = await this.corporationDao.getCorporationById(corporationId);
    if (!corporation) {
      throw new NotFoundException(`Corporation with ID ${corporationId} not found`);
    }
    
    return await this.assetHoldingDao.getAssetsByCorporationId(corporationId);
  }

  /**
   * Get a specific holding by corporation ID and asset ID
   */
  async getHolding(corporationId: string, assetId: string): Promise<HoldingDto | null> {
    this.logger.log(`Getting holding for corporation: ${corporationId}, asset: ${assetId}`);
    
    // Validate corporation exists
    const corporation = await this.corporationDao.getCorporationById(corporationId);
    if (!corporation) {
      throw new NotFoundException(`Corporation with ID ${corporationId} not found`);
    }
    
    return await this.assetHoldingDao.getAsset(corporationId, assetId);
  }

  /**
   * Create or update a holding
   */
  async upsertHolding(corporationId: string, assetId: string, quantity: number): Promise<boolean> {
    this.logger.log(`Upserting holding for corporation: ${corporationId}, asset: ${assetId}, quantity: ${quantity}`);
    
    // Validate corporation exists
    const corporation = await this.corporationDao.getCorporationById(corporationId);
    if (!corporation) {
      throw new NotFoundException(`Corporation with ID ${corporationId} not found`);
    }
    
    return await this.assetHoldingDao.upsertAsset(corporationId, assetId, quantity);
  }

  /**
   * Set holding quantity to a specific value
   */
  async setHoldingQuantity(corporationId: string, assetId: string, quantity: number): Promise<boolean> {
    this.logger.log(`Setting holding quantity for corporation: ${corporationId}, asset: ${assetId}, quantity: ${quantity}`);
    
    // Validate corporation exists
    const corporation = await this.corporationDao.getCorporationById(corporationId);
    if (!corporation) {
      throw new NotFoundException(`Corporation with ID ${corporationId} not found`);
    }
    
    return await this.assetHoldingDao.setAssetQuantity(corporationId, assetId, quantity);
  }

  /**
   * Adjust holding quantity by a delta amount
   */
  async adjustHoldingQuantity(
    corporationId: string,
    assetId: string,
    deltaQuantity: number,
  ): Promise<boolean> {
    this.logger.log(`Adjusting holding quantity for corporation: ${corporationId}, asset: ${assetId}, delta: ${deltaQuantity}`);
    
    // Validate corporation exists
    const corporation = await this.corporationDao.getCorporationById(corporationId);
    if (!corporation) {
      throw new NotFoundException(`Corporation with ID ${corporationId} not found`);
    }
    
    return await this.assetHoldingDao.adjustAssetQuantity(corporationId, assetId, deltaQuantity);
  }
}

