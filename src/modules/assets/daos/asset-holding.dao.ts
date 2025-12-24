import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { HoldingDto } from "../dtos/holding.dto";
import { sql } from "kysely";

@Injectable()
export class AssetHoldingDao extends KyselyDao<AssetHoldingDao> {
  /**
   * Get all assets (holdings) for a corporation
   */
  async getAssetsByCorporationId(corporationId: string): Promise<HoldingDto[]> {
    try {
      const holdings = await this.kysely
        .selectFrom('holdings')
        .leftJoin('assets', 'holdings.asset_id', 'assets.id')
        .select([
          'holdings.id',
          'holdings.corporation_id',
          'holdings.asset_id',
          'holdings.quantity',
          'holdings.average_cost_basis',
          'holdings.total_cost',
          'holdings.created_at',
          'holdings.updated_at',
          'assets.symbol as asset_symbol',
          'assets.name as asset_name',
        ] as any)
        .where('holdings.corporation_id', '=', corporationId)
        .orderBy('holdings.created_at', 'desc')
        .execute();

      return (holdings || []).map((holding) => this.mapRecordToDto(holding));
    } catch (error) {
      console.error("Error getting assets by corporation ID:", error);
      return [];
    }
  }

  /**
   * Get a specific asset holding by corporation ID and asset ID
   */
  async getAsset(
    corporationId: string,
    assetId: string,
  ): Promise<HoldingDto | null> {
    try {
      const holding = await this.kysely
        .selectFrom('holdings')
        .leftJoin('assets', 'holdings.asset_id', 'assets.id')
        .select([
          'holdings.id',
          'holdings.corporation_id',
          'holdings.asset_id',
          'holdings.quantity',
          'holdings.average_cost_basis',
          'holdings.total_cost',
          'holdings.created_at',
          'holdings.updated_at',
          'assets.symbol as asset_symbol',
          'assets.name as asset_name',
        ] as any)
        .where('holdings.corporation_id', '=', corporationId)
        .where('holdings.asset_id', '=', assetId)
        .executeTakeFirst();

      if (!holding) {
        return null;
      }

      return this.mapRecordToDto(holding);
    } catch (error) {
      console.error("Error getting asset:", error);
      return null;
    }
  }

  /**
   * Get or create an asset holding and return its ID
   */
  async getOrCreateAssetId(
    corporationId: string,
    assetId: string,
    trx?: any,
  ): Promise<string | null> {
    try {
      const db = trx || this.kysely;
      
      // Try to get existing holding
      const existing = await db
        .selectFrom('holdings')
        .select('id')
        .where('corporation_id', '=', corporationId)
        .where('asset_id', '=', assetId)
        .executeTakeFirst();

      if (existing) {
        return existing.id;
      }

      // Create new holding if it doesn't exist
      const result = await db
        .insertInto('holdings')
        .values({
          corporation_id: corporationId,
          asset_id: assetId,
          quantity: '0',
          average_cost_basis: '0',
          total_cost: '0',
        } as any)
        .returning('id')
        .executeTakeFirst();

      return result?.id || null;
    } catch (error) {
      console.error("Error getting or creating asset ID:", error);
      return null;
    }
  }

  /**
   * Create or update an asset quantity
   */
  async upsertAsset(
    corporationId: string,
    assetId: string,
    quantity: number,
  ): Promise<boolean> {
    try {
      await this.kysely
        .insertInto('holdings')
        .values({
          corporation_id: corporationId,
          asset_id: assetId,
          quantity: quantity.toString(),
          average_cost_basis: '0',
          total_cost: '0',
        } as any)
        .onConflict((oc) => 
          oc.columns(['corporation_id', 'asset_id']).doUpdateSet({
            quantity: sql`holdings.quantity + EXCLUDED.quantity`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          } as any)
        )
        .execute();

      return true;
    } catch (error) {
      console.error("Error upserting asset:", error);
      return false;
    }
  }

  /**
   * Set asset quantity to a specific value
   */
  async setAssetQuantity(
    corporationId: string,
    assetId: string,
    quantity: number,
  ): Promise<boolean> {
    try {
      await this.kysely
        .insertInto('holdings')
        .values({
          corporation_id: corporationId,
          asset_id: assetId,
          quantity: quantity.toString(),
          average_cost_basis: '0',
          total_cost: '0',
        } as any)
        .onConflict((oc) => 
          oc.columns(['corporation_id', 'asset_id']).doUpdateSet({
            quantity: quantity.toString(),
            updated_at: sql`CURRENT_TIMESTAMP`,
          } as any)
        )
        .execute();

      return true;
    } catch (error) {
      console.error("Error setting asset quantity:", error);
      return false;
    }
  }

  /**
   * Adjust asset quantity by a delta amount (can be negative)
   * Includes quantity check to prevent negative holdings
   */
  async adjustAssetQuantity(
    corporationId: string,
    assetId: string,
    deltaQuantity: number,
    trx?: any,
  ): Promise<boolean> {
    try {
      const db = trx || this.kysely;
      
      // For negative deltas, check we have sufficient quantity
      if (deltaQuantity < 0) {
        const result = await db
          .updateTable('holdings')
          .set({
            quantity: sql`quantity + ${deltaQuantity.toString()}`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where('corporation_id', '=', corporationId)
          .where('asset_id', '=', assetId)
          .where('quantity', '>=', Math.abs(deltaQuantity).toString()) // Prevent negative holdings
          .executeTakeFirst();
        return result.numUpdatedRows > 0;
      } else {
        // For positive deltas, try to update existing holding
        const result = await db
          .updateTable('holdings')
          .set({
            quantity: sql`quantity + ${deltaQuantity.toString()}`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where('corporation_id', '=', corporationId)
          .where('asset_id', '=', assetId)
          .executeTakeFirst();

        // If no existing holding, create a new one
        if (Number(result.numUpdatedRows) === 0) {
          await db
            .insertInto('holdings')
            .values({
              corporation_id: corporationId,
              asset_id: assetId,
              quantity: deltaQuantity.toString(),
              average_cost_basis: '0',
              total_cost: '0',
            } as any)
            .execute();
        }
        return true;
      }
    } catch (error) {
      console.error("Error adjusting asset quantity:", error);
      return false;
    }
  }

  /**
   * Atomically check and reserve asset quantity (for order placement)
   * Returns true if reservation successful, false if insufficient quantity
   */
  async reserveAsset(
    corporationId: string,
    assetId: string,
    quantity: number,
  ): Promise<boolean> {
    try {
      // First, ensure the holding exists (create with 0 if it doesn't)
      await this.getOrCreateAssetId(corporationId, assetId);
      
      // Get current quantity to check if we have enough
      const currentHolding = await this.getAsset(corporationId, assetId);
      const currentQuantity = currentHolding ? parseFloat(currentHolding.quantity.toString()) : 0;
      
      if (currentQuantity < quantity) {
        console.error(`Failed to reserve asset: insufficient quantity. Corporation: ${corporationId}, Asset: ${assetId}, Current: ${currentQuantity}, Required: ${quantity}`);
        return false;
      }
      
      // Then try to reserve (deduct) the quantity atomically
      // Use numeric comparison to avoid string comparison issues
      const quantityStr = quantity.toString();
      const result = await this.kysely
        .updateTable('holdings')
        .set({
          quantity: sql`quantity - ${quantityStr}::numeric`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where('corporation_id', '=', corporationId)
        .where('asset_id', '=', assetId)
        .where((eb) => eb('quantity', '>=', quantityStr)) // String comparison should work for numeric strings
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) {
        // No rows updated means insufficient holdings (race condition or precision issue)
        console.error(`Failed to reserve asset: update failed. Corporation: ${corporationId}, Asset: ${assetId}, Current: ${currentQuantity}, Required: ${quantity}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error reserving asset:", error);
      return false;
    }
  }

  /**
   * Delete assets with zero or negative quantity
   */
  async cleanupZeroAssets(corporationId?: string): Promise<number> {
    try {
      let query = this.kysely
        .deleteFrom('holdings')
        .where('quantity', '<=', '0');

      if (corporationId) {
        query = query.where('corporation_id', '=', corporationId);
      }

      const result = await query.executeTakeFirst();
      return Number(result.numDeletedRows) || 0;
    } catch (error) {
      console.error("Error cleaning up zero assets:", error);
      return 0;
    }
  }

  /**
   * Delete all assets for a corporation
   */
  async deleteCorporationAssets(corporationId: string): Promise<boolean> {
    try {
      await this.kysely
        .deleteFrom('holdings')
        .where('corporation_id', '=', corporationId)
        .execute();

      return true;
    } catch (error) {
      console.error("Error deleting corporation assets:", error);
      return false;
    }
  }

  /**
   * Map database record to HoldingDto
   */
  private mapRecordToDto(record: any): HoldingDto {
    const dto = new HoldingDto();
    dto.id = record.id;
    dto.corporationId = record.corporation_id;
    dto.assetId = record.asset_id;
    dto.assetSymbol = record.asset_symbol;
    dto.assetName = record.asset_name;
    dto.quantity = parseFloat(record.quantity);
    dto.averageCostBasis = record.average_cost_basis ? parseFloat(record.average_cost_basis) : undefined;
    dto.totalCost = record.total_cost ? parseFloat(record.total_cost) : undefined;
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    return dto;
  }

  /**
   * Update cost basis when buying assets (weighted average)
   * When buying: new_average = (old_total_cost + new_cost) / (old_quantity + new_quantity)
   */
  async updateCostBasisOnPurchase(
    corporationId: string,
    assetId: string,
    purchaseQuantity: number,
    purchasePrice: number,
    trx?: any,
  ): Promise<boolean> {
    try {
      const db = trx || this.kysely;
      const purchaseCost = purchaseQuantity * purchasePrice;

      // Get current holding
      const current = await db
        .selectFrom('holdings')
        .select(['quantity', 'average_cost_basis', 'total_cost'])
        .where('corporation_id', '=', corporationId)
        .where('asset_id', '=', assetId)
        .executeTakeFirst();

      if (!current) {
        // New holding - set cost basis to purchase price
        const result = await db
          .updateTable('holdings')
          .set({
            average_cost_basis: purchasePrice.toString(),
            total_cost: purchaseCost.toString(),
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where('corporation_id', '=', corporationId)
          .where('asset_id', '=', assetId)
          .executeTakeFirst();
        return Number(result.numUpdatedRows) > 0;
      }

      const oldQuantity = parseFloat(current.quantity);
      const oldTotalCost = parseFloat(current.total_cost || '0');
      const oldAverageCostBasis = parseFloat(current.average_cost_basis || '0');
      
      // Note: adjustAssetQuantity is called before this method, so oldQuantity already includes the purchaseQuantity
      const originalQuantity = Math.max(0, oldQuantity - purchaseQuantity);
      
      let newQuantity: number;
      let newTotalCost: number;
      let newAverageCostBasis: number;
      
      if (oldAverageCostBasis > 0) {
        // Normal case: existing holding has cost basis, calculate weighted average
        const originalTotalCost = originalQuantity > 0 ? (originalQuantity * oldAverageCostBasis) : 0;
        newQuantity = oldQuantity; // Already includes purchase
        newTotalCost = originalTotalCost + purchaseCost;
        newAverageCostBasis = newQuantity > 0 ? newTotalCost / newQuantity : 0;
      } else if (originalQuantity > 0) {
        // Special case: existing holding had no cost basis but had quantity
        newQuantity = oldQuantity; // Already includes purchase
        newAverageCostBasis = purchasePrice;
        newTotalCost = newQuantity * purchasePrice;
      } else {
        // New holding (no existing quantity) - set cost basis to purchase price
        newQuantity = oldQuantity; // Should equal purchaseQuantity
        newAverageCostBasis = purchasePrice;
        newTotalCost = purchaseCost;
      }

      // Update with weighted average
      const result = await db
        .updateTable('holdings')
        .set({
          average_cost_basis: newAverageCostBasis.toString(),
          total_cost: newTotalCost.toString(),
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where('corporation_id', '=', corporationId)
        .where('asset_id', '=', assetId)
        .executeTakeFirst();

      return Number(result.numUpdatedRows) > 0;
    } catch (error) {
      console.error("Error updating cost basis on purchase:", error);
      return false;
    }
  }

  /**
   * Update cost basis when selling assets (FIFO - first in, first out)
   * When selling, we don't change the average cost basis, just reduce total_cost proportionally
   */
  async updateCostBasisOnSale(
    corporationId: string,
    assetId: string,
    saleQuantity: number,
    trx?: any,
  ): Promise<boolean> {
    try {
      const db = trx || this.kysely;

      // Get current holding
      const current = await db
        .selectFrom('holdings')
        .select(['quantity', 'average_cost_basis', 'total_cost'])
        .where('corporation_id', '=', corporationId)
        .where('asset_id', '=', assetId)
        .executeTakeFirst();

      if (!current) {
        return false;
      }

      const oldQuantity = parseFloat(current.quantity);
      const oldTotalCost = parseFloat(current.total_cost || '0');
      const oldAverageCostBasis = parseFloat(current.average_cost_basis || '0');

      if (oldQuantity <= 0) {
        return false;
      }

      // Calculate proportion sold
      const proportionSold = saleQuantity / oldQuantity;
      const costOfSoldQuantity = oldTotalCost * proportionSold;
      const newTotalCost = oldTotalCost - costOfSoldQuantity;
      const newQuantity = oldQuantity - saleQuantity;

      // If all holdings sold, reset cost basis
      const newAverageCostBasis = newQuantity > 0 ? oldAverageCostBasis : 0;

      const result = await db
        .updateTable('holdings')
        .set({
          average_cost_basis: newAverageCostBasis.toString(),
          total_cost: Math.max(0, newTotalCost).toString(),
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where('corporation_id', '=', corporationId)
        .where('asset_id', '=', assetId)
        .executeTakeFirst();

      return Number(result.numUpdatedRows) > 0;
    } catch (error) {
      console.error("Error updating cost basis on sale:", error);
      return false;
    }
  }
}

