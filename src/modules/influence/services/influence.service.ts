import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CorporationDao } from "@/modules/corporations/daos/corporation.dao";
import { AssetService } from "@/modules/assets/services/asset.service";
import { AssetHoldingDao } from "@/modules/assets/daos/asset-holding.dao";

@Injectable()
export class InfluenceService {
  private readonly logger = new Logger(InfluenceService.name);

  constructor(
    private readonly corporationDao: CorporationDao,
    private readonly assetService: AssetService,
    private readonly assetHoldingDao: AssetHoldingDao,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Calculate current influence balance (on-the-fly, like production cycles)
   * Formula: current = base - floor((elapsed_seconds / interval) * deterioration_amount)
   */
  async getInfluenceBalance(corporationId: string): Promise<number> {
    const corporation = await this.corporationDao.getCorporationById(corporationId);
    if (!corporation) {
      throw new NotFoundException(`Corporation ${corporationId} not found`);
    }

    const base = parseFloat(corporation.influenceBase?.toString() || '0');
    const lastUpdated = corporation.influenceLastUpdatedAt || corporation.createdAt || new Date();
    
    const now = Date.now();
    const elapsedSeconds = (now - lastUpdated.getTime()) / 1000;
    
    const deteriorationAmount = this.configService.get<number>('influence.deteriorationAmount');
    const intervalSeconds = this.configService.get<number>('influence.deteriorationIntervalSeconds');
    
    // Calculate deterioration: floor((elapsed / interval) * amount)
    const deterioration = Math.floor((elapsedSeconds / intervalSeconds) * deteriorationAmount);
    
    // Current balance = base - deterioration (never go below 0)
    const current = Math.max(0, base - deterioration);
    
    return current;
  }

  /**
   * Purchase influence using USD
   * Updates base balance and timestamp after calculating current deteriorated balance
   */
  async purchaseInfluence(
    corporationId: string,
    amount: number,
  ): Promise<{ success: boolean; newBalance: number }> {
    this.logger.log(`Purchasing ${amount} influence for corporation ${corporationId}`);

    // Validate amount
    const minPurchase = this.configService.get<number>('influence.minPurchaseAmount');
    if (amount < minPurchase) {
      throw new BadRequestException(`Minimum purchase amount is ${minPurchase}`);
    }

    // Get current balance (with deterioration applied)
    const currentBalance = await this.getInfluenceBalance(corporationId);
    
    // Get USD asset
    const usdAsset = await this.assetService.getAssetBySymbol('USD');
    if (!usdAsset) {
      throw new BadRequestException('USD asset not found');
    }

    // Calculate cost
    const usdCostPerInfluence = this.configService.get<number>('influence.usdCostPerInfluence');
    const cost = amount * usdCostPerInfluence;

    // Check USD balance
    const usdHolding = await this.assetHoldingDao.getAsset(corporationId, usdAsset.id);
    const usdBalance = usdHolding ? parseFloat(usdHolding.quantity.toString()) : 0;
    
    if (usdBalance < cost) {
      throw new BadRequestException(`Insufficient USD balance. Need ${cost}, have ${usdBalance}`);
    }

    // Deduct USD
    const usdDeducted = await this.assetHoldingDao.adjustAssetQuantity(
      corporationId,
      usdAsset.id,
      -cost
    );
    if (!usdDeducted) {
      throw new BadRequestException('Failed to deduct USD');
    }

    // Update influence: new_base = current_balance + purchase_amount
    // This "resets" the deterioration timer
    const newBase = currentBalance + amount;
    const updated = await this.corporationDao.updateInfluenceBase(
      corporationId,
      newBase
    );
    
    if (!updated) {
      // Rollback USD deduction if influence update fails
      await this.assetHoldingDao.adjustAssetQuantity(corporationId, usdAsset.id, cost);
      throw new BadRequestException('Failed to update influence');
    }

    this.logger.log(`Successfully purchased ${amount} influence. New balance: ${newBase}`);
    return { success: true, newBalance: newBase };
  }

  /**
   * Spend influence (for business upgrades, etc.)
   * Calculates current balance on-the-fly before spending
   */
  async spendInfluence(
    corporationId: string,
    amount: number,
  ): Promise<{ success: boolean; newBalance: number }> {
    this.logger.log(`Spending ${amount} influence for corporation ${corporationId}`);

    const currentBalance = await this.getInfluenceBalance(corporationId);
    
    if (currentBalance < amount) {
      throw new BadRequestException(
        `Insufficient influence. Need ${amount}, have ${currentBalance}`
      );
    }

    // Update base: new_base = current_balance - amount
    const newBase = currentBalance - amount;
    const updated = await this.corporationDao.updateInfluenceBase(corporationId, newBase);
    
    if (!updated) {
      throw new BadRequestException('Failed to spend influence');
    }

    this.logger.log(`Successfully spent ${amount} influence. New balance: ${newBase}`);
    return { success: true, newBalance: newBase };
  }
}

