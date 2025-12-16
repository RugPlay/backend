import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { AssetHoldingDao } from "../daos/asset-holding.dao";
import { HoldingDto } from "../dtos/holding.dto";
import { CreateHoldingDto } from "../dtos/create-holding.dto";
import { UpdateHoldingDto } from "../dtos/update-holding.dto";

@Injectable()
export class HoldingService {
  private readonly logger = new Logger(HoldingService.name);

  constructor(
    private readonly assetHoldingDao: AssetHoldingDao,
  ) {}

  /**
   * Get all holdings for a user
   */
  async getHoldingsByUserId(userId: string): Promise<HoldingDto[]> {
    this.logger.log(`Getting holdings for user: ${userId}`);
    return await this.assetHoldingDao.getAssetsByUserId(userId);
  }

  /**
   * Get a specific holding by user ID and asset ID
   */
  async getHolding(userId: string, assetId: string): Promise<HoldingDto | null> {
    this.logger.log(`Getting holding for user: ${userId}, asset: ${assetId}`);
    return await this.assetHoldingDao.getAsset(userId, assetId);
  }

  /**
   * Create or update a holding
   */
  async upsertHolding(userId: string, assetId: string, quantity: number): Promise<boolean> {
    this.logger.log(`Upserting holding for user: ${userId}, asset: ${assetId}, quantity: ${quantity}`);
    return await this.assetHoldingDao.upsertAsset(userId, assetId, quantity);
  }

  /**
   * Set holding quantity to a specific value
   */
  async setHoldingQuantity(userId: string, assetId: string, quantity: number): Promise<boolean> {
    this.logger.log(`Setting holding quantity for user: ${userId}, asset: ${assetId}, quantity: ${quantity}`);
    return await this.assetHoldingDao.setAssetQuantity(userId, assetId, quantity);
  }

  /**
   * Adjust holding quantity by a delta amount
   */
  async adjustHoldingQuantity(
    userId: string,
    assetId: string,
    deltaQuantity: number,
  ): Promise<boolean> {
    this.logger.log(`Adjusting holding quantity for user: ${userId}, asset: ${assetId}, delta: ${deltaQuantity}`);
    return await this.assetHoldingDao.adjustAssetQuantity(userId, assetId, deltaQuantity);
  }
}

