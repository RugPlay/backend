import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CorporationDao } from "@/modules/corporations/daos/corporation.dao";
import { AssetService } from "@/modules/assets/services/asset.service";
import { AssetHoldingDao } from "@/modules/assets/daos/asset-holding.dao";
import { InfluenceEventDao } from "../daos/influence-event.dao";

@Injectable()
export class InfluenceService {
  private readonly logger = new Logger(InfluenceService.name);

  constructor(
    private readonly corporationDao: CorporationDao,
    private readonly assetService: AssetService,
    private readonly assetHoldingDao: AssetHoldingDao,
    private readonly configService: ConfigService,
    private readonly influenceEventDao: InfluenceEventDao,
  ) {}

  /**
   * Calculate current influence balance (on-the-fly, like production cycles)
   * Formula: current = base - floor((elapsed_seconds / interval) * deterioration_amount)
   */
  async getInfluenceBalance(
    corporationId: string,
    syncHoldings: boolean = false,
  ): Promise<number> {
    const current = await this.calculateCurrentInfluence(corporationId);
    
    // Optionally sync holdings if requested
    if (syncHoldings) {
      await this.syncInfluenceHolding(corporationId);
    }
    
    return current;
  }

  /**
   * Calculate current influence from latest event + timestamp
   * Uses events as single source of truth, with holdings as cache
   */
  private async calculateCurrentInfluence(corporationId: string): Promise<number> {
    // Get latest event (single source of truth)
    const latestEvent = await this.influenceEventDao.getLatestEvent(corporationId);
    
    // If no events, corporation has 0 influence
    if (!latestEvent) {
      return 0;
    }

    const base = latestEvent.balance_after;
    const lastUpdated = latestEvent.created_at;
    
    const now = Date.now();
    const elapsedSeconds = (now - lastUpdated.getTime()) / 1000;
    
    const deteriorationAmount = this.configService.get<number>('influence.deteriorationAmount') || 1.0;
    const intervalSeconds = this.configService.get<number>('influence.deteriorationIntervalSeconds') || 3600;
    
    // Calculate deterioration: floor((elapsed / interval) * amount)
    const deterioration = Math.floor((elapsedSeconds / intervalSeconds) * deteriorationAmount);
    
    // Current balance = base - deterioration (never go below 0)
    const current = Math.max(0, base - deterioration);
    
    return current;
  }

  /**
   * Sync influence holdings with calculated current value
   * Called before spending to ensure holdings are accurate
   */
  private async syncInfluenceHolding(corporationId: string): Promise<number> {
    // Calculate current influence (with deterioration)
    const current = await this.calculateCurrentInfluence(corporationId);
    
    // Get influence asset
    const influenceAsset = await this.assetService.getAssetBySymbol('INFLUENCE');
    if (!influenceAsset) {
      throw new BadRequestException('INFLUENCE asset not found');
    }
    
    // Update holdings to match calculated current
    await this.assetHoldingDao.setAssetQuantity(
      corporationId,
      influenceAsset.id,
      current
    );
    
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
    const minPurchase = this.configService.get<number>('influence.minPurchaseAmount') || 1.0;
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
    const usdCostPerInfluence = this.configService.get<number>('influence.usdCostPerInfluence') || 100.0;
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

    // Calculate new balance: current + purchase amount
    const newBalance = currentBalance + amount;

    // Record event (single source of truth)
    const eventRecorded = await this.influenceEventDao.recordEvent(
      corporationId,
      "purchase",
      amount,
      newBalance
    );
    
    if (!eventRecorded) {
      // Rollback USD deduction if event recording fails
      await this.assetHoldingDao.adjustAssetQuantity(corporationId, usdAsset.id, cost);
      throw new BadRequestException('Failed to record influence event');
    }

    // Update holdings cache (for fast lookups)
    const influenceAsset = await this.assetService.getAssetBySymbol('INFLUENCE');
    if (!influenceAsset) {
      throw new BadRequestException('INFLUENCE asset not found');
    }
    
    await this.assetHoldingDao.setAssetQuantity(
      corporationId,
      influenceAsset.id,
      newBalance
    );

    this.logger.log(`Successfully purchased ${amount} influence. New balance: ${newBalance}`);
    return { success: true, newBalance: newBalance };
  }

  /**
   * Spend influence (for business upgrades, etc.)
   * Syncs holdings first to ensure accuracy, then spends
   */
  async spendInfluence(
    corporationId: string,
    amount: number,
  ): Promise<{ success: boolean; newBalance: number }> {
    this.logger.log(`Spending ${amount} influence for corporation ${corporationId}`);

    // 1. SYNC holdings first (ensures accuracy with deterioration)
    const current = await this.syncInfluenceHolding(corporationId);
    
    // 2. Check if sufficient
    if (current < amount) {
      throw new BadRequestException(
        `Insufficient influence. Need ${amount}, have ${current}`
      );
    }

    // 3. Calculate new balance (current - amount)
    const newBalance = current - amount;
    
    // 4. Record event (single source of truth)
    const eventRecorded = await this.influenceEventDao.recordEvent(
      corporationId,
      "spend",
      -amount,
      newBalance
    );
    
    if (!eventRecorded) {
      throw new BadRequestException('Failed to record influence event');
    }

    // 5. Update holdings cache (for fast lookups)
    const influenceAsset = await this.assetService.getAssetBySymbol('INFLUENCE');
    if (!influenceAsset) {
      throw new BadRequestException('INFLUENCE asset not found');
    }
    
    await this.assetHoldingDao.setAssetQuantity(
      corporationId,
      influenceAsset.id,
      newBalance
    );

    this.logger.log(`Successfully spent ${amount} influence. New balance: ${newBalance}`);
    return { success: true, newBalance: newBalance };
  }
}

