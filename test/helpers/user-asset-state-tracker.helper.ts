import { INestApplication } from '@nestjs/common';
import { AssetHoldingDao } from '../../src/modules/assets/daos/asset-holding.dao';

export interface UserAssetState {
  userId: string;
  startingAssets: Record<string, number>; // assetId -> quantity
  expectedAssets: Record<string, number>; // assetId -> quantity
  reservedAssets: Record<string, number>; // assetId -> quantity reserved for pending orders
}

export class UserAssetStateTracker {
  private users: Map<string, UserAssetState> = new Map();

  /**
   * Register a user with starting asset state
   */
  registerUser(
    userId: string,
    startingAssets: Record<string, number> = {}
  ): void {
    this.users.set(userId, {
      userId,
      startingAssets: { ...startingAssets },
      expectedAssets: { ...startingAssets },
      reservedAssets: {},
    });
  }

  /**
   * Register a user by reading their current state from the database
   */
  async registerUserFromCurrentState(
    app: INestApplication,
    userId: string
  ): Promise<void> {
    const assetHoldingDao = app.get(AssetHoldingDao);
    const currentAssets = await assetHoldingDao.getAssetsByUserId(userId);
    
    const assetsMap: Record<string, number> = {};
    for (const asset of currentAssets) {
      assetsMap[asset.assetId] = parseFloat(asset.quantity.toString());
    }

    this.users.set(userId, {
      userId,
      startingAssets: { ...assetsMap },
      expectedAssets: { ...assetsMap },
      reservedAssets: {},
    });
  }

  /**
   * Record a trade that affects user asset state
   * @param userId - User ID
   * @param baseAssetId - Base asset ID (the asset being traded)
   * @param quoteAssetId - Quote asset ID (the asset used for pricing)
   * @param side - "bid" (buy) or "ask" (sell)
   * @param price - Trade price
   * @param quantity - Trade quantity
   * @param wasReserved - Whether the assets were already reserved (default: false)
   */
  recordTrade(
    userId: string,
    baseAssetId: string,
    quoteAssetId: string,
    side: 'bid' | 'ask',
    price: number,
    quantity: number,
    wasReserved: boolean = false
  ): void {
    const state = this.users.get(userId);
    if (!state) {
      throw new Error(`User ${userId} not registered`);
    }

    if (side === 'bid') {
      // Buying: spend quote asset, gain base asset
      const cost = price * quantity;
      if (wasReserved) {
        // Quote asset was already reserved, just convert reservation to spent
        state.reservedAssets[quoteAssetId] = Math.max(0, (state.reservedAssets[quoteAssetId] || 0) - cost);
      } else {
        // Quote asset wasn't reserved, subtract it now
        state.expectedAssets[quoteAssetId] = (state.expectedAssets[quoteAssetId] || 0) - cost;
      }
      // Gain base asset
      state.expectedAssets[baseAssetId] = (state.expectedAssets[baseAssetId] || 0) + quantity;
    } else {
      // Selling: gain quote asset, lose base asset
      const proceeds = price * quantity;
      // Gain quote asset
      state.expectedAssets[quoteAssetId] = (state.expectedAssets[quoteAssetId] || 0) + proceeds;
      
      if (wasReserved) {
        // Base asset was already reserved (deducted from DB) when order was placed
        // The reservation already reduced expectedAssets, so we just need to release the reservation
        // The actual database quantity was already reduced when we reserved, so we update startingAssets
        // to reflect that the asset is now permanently gone (not just reserved)
        state.reservedAssets[baseAssetId] = Math.max(0, (state.reservedAssets[baseAssetId] || 0) - quantity);
        // Update starting assets to reflect the permanent sale (the DB already deducted it when reserved)
        state.startingAssets[baseAssetId] = (state.startingAssets[baseAssetId] || 0) - quantity;
        // Recalculate expected assets: starting - remaining reserved
        // The expectedAssets should now reflect the new starting amount minus any remaining reservations
        const newStarting = state.startingAssets[baseAssetId] || 0;
        const remainingReserved = state.reservedAssets[baseAssetId] || 0;
        state.expectedAssets[baseAssetId] = newStarting - remainingReserved;
      } else {
        // Base asset wasn't reserved, subtract it now
        state.expectedAssets[baseAssetId] = (state.expectedAssets[baseAssetId] || 0) - quantity;
        state.startingAssets[baseAssetId] = (state.startingAssets[baseAssetId] || 0) - quantity;
      }
      
      // Remove asset if quantity reaches zero or below
      const currentAsset = state.expectedAssets[baseAssetId] || 0;
      if (currentAsset <= 0 && !state.reservedAssets[baseAssetId]) {
        delete state.expectedAssets[baseAssetId];
      }
    }
  }

  /**
   * Reserve quote asset (for pending BID orders)
   */
  reserveQuoteAsset(userId: string, assetId: string, amount: number): void {
    const state = this.users.get(userId);
    if (!state) {
      throw new Error(`User ${userId} not registered`);
    }
    state.expectedAssets[assetId] = (state.expectedAssets[assetId] || 0) - amount;
    state.reservedAssets[assetId] = (state.reservedAssets[assetId] || 0) + amount;
  }

  /**
   * Reserve base asset (for pending ASK orders)
   */
  reserveBaseAsset(userId: string, assetId: string, quantity: number): void {
    const state = this.users.get(userId);
    if (!state) {
      throw new Error(`User ${userId} not registered`);
    }
    state.reservedAssets[assetId] = (state.reservedAssets[assetId] || 0) + quantity;
    const startingAsset = state.startingAssets[assetId] || 0;
    state.expectedAssets[assetId] = startingAsset - (state.reservedAssets[assetId] || 0);
  }

  /**
   * Release reserved asset (when order is filled or cancelled)
   */
  releaseAsset(userId: string, assetId: string, amount: number): void {
    const state = this.users.get(userId);
    if (!state) {
      throw new Error(`User ${userId} not registered`);
    }
    state.expectedAssets[assetId] = (state.expectedAssets[assetId] || 0) + amount;
    state.reservedAssets[assetId] = Math.max(0, (state.reservedAssets[assetId] || 0) - amount);
  }

  /**
   * Get expected state for a user
   */
  getExpectedState(userId: string): UserAssetState | undefined {
    return this.users.get(userId);
  }

  /**
   * Verify user asset quantity matches expected
   */
  async verifyAsset(
    app: INestApplication,
    userId: string,
    assetId: string,
    tolerance: number = 0.0001
  ): Promise<{ success: boolean; expected: number; actual: number; difference: number }> {
    const state = this.users.get(userId);
    if (!state) {
      throw new Error(`User ${userId} not registered`);
    }

    const assetHoldingDao = app.get(AssetHoldingDao);
    const asset = await assetHoldingDao.getAsset(userId, assetId);
    
    const expectedAvailableQuantity = state.expectedAssets[assetId] || 0;
    const reservedQuantity = state.reservedAssets[assetId] || 0;
    const expectedTotalQuantity = expectedAvailableQuantity + reservedQuantity;
    
    const actualQuantity = asset ? parseFloat(asset.quantity.toString()) : 0;
    
    const difference = Math.abs(actualQuantity - expectedTotalQuantity);
    const success = difference <= tolerance;

    return {
      success,
      expected: expectedTotalQuantity,
      actual: actualQuantity,
      difference,
    };
  }

  /**
   * Verify all assets for a user
   */
  async verifyAllAssets(
    app: INestApplication,
    userId: string,
    tolerance: number = 0.0001
  ): Promise<Map<string, { success: boolean; expected: number; actual: number; difference: number }>> {
    const state = this.users.get(userId);
    if (!state) {
      throw new Error(`User ${userId} not registered`);
    }

    const results = new Map<string, { success: boolean; expected: number; actual: number; difference: number }>();
    
    // Check all expected assets
    for (const [assetId, expectedQuantity] of Object.entries(state.expectedAssets)) {
      const result = await this.verifyAsset(app, userId, assetId, tolerance);
      results.set(assetId, result);
    }

    // Check for assets that exist but shouldn't
    const assetHoldingDao = app.get(AssetHoldingDao);
    const allAssets = await assetHoldingDao.getAssetsByUserId(userId);
    
    for (const asset of allAssets) {
      const assetId = asset.assetId;
      if (!state.expectedAssets[assetId] || state.expectedAssets[assetId] <= 0) {
        const actualQuantity = parseFloat(asset.quantity.toString());
        if (actualQuantity > tolerance) {
          results.set(assetId, {
            success: false,
            expected: 0,
            actual: actualQuantity,
            difference: actualQuantity,
          });
        }
      }
    }

    return results;
  }

  /**
   * Verify complete user state (all assets)
   */
  async verifyUser(
    app: INestApplication,
    userId: string,
    tolerance: number = 0.0001
  ): Promise<{
    userId: string;
    assets: Map<string, { success: boolean; expected: number; actual: number; difference: number }>;
    allSuccess: boolean;
  }> {
    const assets = await this.verifyAllAssets(app, userId, tolerance);
    
    const allAssetsSuccess = Array.from(assets.values()).every(a => a.success);
    const allSuccess = allAssetsSuccess;

    return {
      userId,
      assets,
      allSuccess,
    };
  }

  /**
   * Reset tracker (clear all registered users)
   */
  reset(): void {
    this.users.clear();
  }
}

