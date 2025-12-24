import { INestApplication } from '@nestjs/common';
import { OrderService } from '../../src/modules/exchange/services/order.service';
import { MarketService } from '../../src/modules/exchange/services/market.service';
import { AssetService } from '../../src/modules/assets/services/asset.service';
import { AssetHoldingDao } from '../../src/modules/assets/daos/asset-holding.dao';
import { CorporationService } from '../../src/modules/corporations/services/corporation.service';
import { Kysely, sql } from 'kysely';
import { DB } from '../../src/database/types/db';
import { REDIS_CLIENT } from '../../src/redis/constants/redis.constants';
import Redis from 'ioredis';

export class TestCleanupHelper {
  /**
   * Clean up all test data from database and Redis
   * Uses Kysely directly to truncate tables (test-only operation)
   */
  static async cleanupTestData(app: INestApplication): Promise<void> {
    const orderService = app.get(OrderService);
    // Get Kysely instance from any DAO (they all have it)
    const assetHoldingDao = app.get(AssetHoldingDao);
    const kysely = (assetHoldingDao as any).kysely as Kysely<DB>;

    try {
      // Clear Redis data
      await orderService.clearAllRedisData();

      // Delete database tables using Kysely directly (test-only operation)
      // Order matters due to foreign key constraints
      // Disable foreign key checks temporarily for deletion
      await sql`SET session_replication_role = replica`.execute(kysely);
      
      await kysely.deleteFrom('trades').execute();
      await kysely.deleteFrom('orders').execute();
      await kysely.deleteFrom('holdings').execute();
      await kysely.deleteFrom('markets').execute();
      await kysely.deleteFrom('assets').execute();
      
      // Re-enable foreign key checks
      await sql`SET session_replication_role = DEFAULT`.execute(kysely);
    } catch (error) {
      console.error('Error during test cleanup:', error);
    }
  }

  /**
   * Create a test corporation
   */
  static async createTestCorporation(
    app: INestApplication,
    name: string = `Test Corp ${Date.now()}`
  ): Promise<string> {
    const corporationService = app.get(CorporationService);
    
    const corporation = await corporationService.createCorporation({
      name,
      description: 'Test corporation',
      industry: 'technology',
      isActive: true,
    });

    return corporation.id;
  }

  /**
   * Create test assets (USD and BTC for example)
   */
  static async createTestAssets(
    app: INestApplication,
  ): Promise<{ usdAssetId: string; btcAssetId: string }> {
    const assetService = app.get(AssetService);
    
    // Create USD asset
    const usdAsset = await assetService.createAsset({
      symbol: 'USD',
      name: 'US Dollar',
      type: 'currency',
      decimals: 2,
      isActive: true,
    });

    // Create BTC asset
    const btcAsset = await assetService.createAsset({
      symbol: 'BTC',
      name: 'Bitcoin',
      type: 'crypto',
      decimals: 8,
      isActive: true,
    });

    return {
      usdAssetId: usdAsset.id,
      btcAssetId: btcAsset.id,
    };
  }

  /**
   * Create a test asset holding for a corporation
   */
  static async createTestAssetHolding(
    app: INestApplication,
    corporationId: string,
    assetId: string,
    quantity: number
  ): Promise<void> {
    const assetHoldingDao = app.get(AssetHoldingDao);
    
    const success = await assetHoldingDao.adjustAssetQuantity(
      corporationId,
      assetId,
      quantity,
    );

    if (!success) {
      throw new Error(`Failed to create test asset holding for corporation ${corporationId} with asset ${assetId}`);
    }
  }

  /**
   * Ensure corporation has at least the specified asset quantity, adding more if needed
   */
  static async ensureMinimumAssetQuantity(
    app: INestApplication,
    corporationId: string,
    assetId: string,
    minimumQuantity: number
  ): Promise<void> {
    const assetHoldingDao = app.get(AssetHoldingDao);
    const currentAsset = await assetHoldingDao.getAsset(corporationId, assetId);
    
    const currentQuantity = currentAsset?.quantity || 0;

    if (currentQuantity < minimumQuantity) {
      const needed = minimumQuantity - currentQuantity;
      const success = await assetHoldingDao.adjustAssetQuantity(corporationId, assetId, needed);
      if (!success) {
        throw new Error(`Failed to adjust asset quantity for corporation ${corporationId} asset ${assetId}`);
      }
    }
  }

  /**
   * Reset corporation asset quantity to a specific amount
   */
  static async resetAssetQuantity(
    app: INestApplication,
    corporationId: string,
    assetId: string,
    targetQuantity: number
  ): Promise<void> {
    const assetHoldingDao = app.get(AssetHoldingDao);
    const currentAsset = await assetHoldingDao.getAsset(corporationId, assetId);
    
    const currentQuantity = currentAsset?.quantity || 0;

    const difference = targetQuantity - currentQuantity;
    if (Math.abs(difference) > 0.01) {
      const success = await assetHoldingDao.adjustAssetQuantity(corporationId, assetId, difference);
      if (!success) {
        throw new Error(`Failed to reset asset quantity for corporation ${corporationId} asset ${assetId} to ${targetQuantity}`);
      }
    }
  }

  /**
   * Clear all assets for a corporation
   */
  static async clearCorporationAssets(
    app: INestApplication,
    corporationId: string
  ): Promise<void> {
    const assetHoldingDao = app.get(AssetHoldingDao);
    await assetHoldingDao.deleteCorporationAssets(corporationId);
  }

  /**
   * Reset corporation to a clean state (all assets)
   */
  static async resetCorporation(
    app: INestApplication,
    corporationId: string,
    assets: Array<{ assetId: string; quantity: number }>
  ): Promise<void> {
    await this.clearCorporationAssets(app, corporationId);
    for (const asset of assets) {
      await this.resetAssetQuantity(app, corporationId, asset.assetId, asset.quantity);
    }
  }
}
