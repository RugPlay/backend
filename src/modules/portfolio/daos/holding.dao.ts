import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { HoldingDto } from "../dtos/holding.dto";
import { sql } from "kysely";

@Injectable()
export class HoldingDao extends KyselyDao<HoldingDao> {
  /**
   * Get user_id from portfolio_id
   */
  private async getUserIdFromPortfolioId(portfolioId: string, trx?: any): Promise<string | null> {
    try {
      const db = trx || this.kysely;
      const portfolio = await db
        .selectFrom('portfolios')
        .select('user_id')
        .where('id', '=', portfolioId)
        .executeTakeFirst();
      
      return portfolio?.user_id || null;
    } catch (error) {
      console.error("Error getting user_id from portfolio_id:", error);
      return null;
    }
  }

  /**
   * Get all holdings for a portfolio
   */
  async getHoldingsByPortfolioId(portfolioId: string): Promise<HoldingDto[]> {
    try {
      const holdings = await this.kysely
        .selectFrom('holdings')
        .selectAll()
        .where('portfolio_id', '=', portfolioId)
        .orderBy('created_at', 'desc')
        .execute();

      return (holdings || []).map((holding) => this.mapRecordToDto(holding));
    } catch (error) {
      console.error("Error getting holdings by portfolio ID:", error);
      return [];
    }
  }

  /**
   * Get all holdings for a portfolio with market information
   */
  async getHoldingsWithMarketByPortfolioId(
    portfolioId: string,
  ): Promise<HoldingDto[]> {
    try {
      const holdings = await this.kysely
        .selectFrom('holdings')
        .leftJoin('markets', 'holdings.market_id', 'markets.id')
        .select([
          'holdings.id',
          'holdings.portfolio_id',
          'holdings.user_id',
          'holdings.market_id',
          'holdings.quantity',
          'holdings.average_cost_basis',
          'holdings.total_cost',
          'holdings.created_at',
          'holdings.updated_at',
          'markets.symbol as market_symbol',
          'markets.name as market_name',
        ] as any)
        .where('holdings.portfolio_id', '=', portfolioId)
        .orderBy('holdings.created_at', 'desc')
        .execute();

      return (holdings || []).map((holding) =>
        this.mapRecordWithMarketToDto(holding),
      );
    } catch (error) {
      console.error(
        "Error getting holdings with market by portfolio ID:",
        error,
      );
      return [];
    }
  }

  /**
   * Get a specific holding by portfolio ID and market ID
   */
  async getHolding(
    portfolioId: string,
    marketId: string,
  ): Promise<HoldingDto | null> {
    try {
      const holding = await this.kysely
        .selectFrom('holdings')
        .selectAll()
        .where('portfolio_id', '=', portfolioId)
        .where('market_id', '=', marketId)
        .executeTakeFirst();

      if (!holding) {
        return null;
      }

      return this.mapRecordToDto(holding);
    } catch (error) {
      console.error("Error getting holding:", error);
      return null;
    }
  }

  /**
   * Get or create a holding and return its ID
   */
  async getOrCreateHoldingId(
    portfolioId: string,
    marketId: string,
    userId?: string,
    trx?: any,
  ): Promise<string | null> {
    try {
      const db = trx || this.kysely;
      
      // Try to get existing holding
      const existing = await db
        .selectFrom('holdings')
        .select('id')
        .where('portfolio_id', '=', portfolioId)
        .where('market_id', '=', marketId)
        .executeTakeFirst();

      if (existing) {
        return existing.id;
      }

      // Get userId if not provided
      let finalUserId: string | undefined = userId;
      if (!finalUserId) {
        const fetchedUserId = await this.getUserIdFromPortfolioId(portfolioId, trx);
        if (!fetchedUserId) {
          console.error("Error: Could not get user_id for portfolio", portfolioId);
          return null;
        }
        finalUserId = fetchedUserId;
      }

      // Create new holding if it doesn't exist
      const result = await db
        .insertInto('holdings')
        .values({
          portfolio_id: portfolioId,
          user_id: finalUserId,
          market_id: marketId,
          quantity: '0',
          average_cost_basis: '0',
          total_cost: '0',
        } as any)
        .returning('id')
        .executeTakeFirst();

      return result?.id || null;
    } catch (error) {
      console.error("Error getting or creating holding ID:", error);
      return null;
    }
  }

  /**
   * Create or update a holding quantity
   */
  async upsertHolding(
    portfolioId: string,
    marketId: string,
    quantity: number,
    userId?: string,
  ): Promise<boolean> {
    try {
      // Get userId if not provided
      let finalUserId = userId;
      if (!finalUserId) {
        const fetchedUserId = await this.getUserIdFromPortfolioId(portfolioId);
        if (!fetchedUserId) {
          console.error("Error: Could not get user_id for portfolio", portfolioId);
          return false;
        }
        finalUserId = fetchedUserId;
      }

      await this.kysely
        .insertInto('holdings')
        .values({
          portfolio_id: portfolioId,
          user_id: finalUserId,
          market_id: marketId,
          quantity: quantity.toString(),
          average_cost_basis: '0',
          total_cost: '0',
        } as any)
        .onConflict((oc) => 
          oc.columns(['portfolio_id', 'market_id']).doUpdateSet({
            quantity: sql`holdings.quantity + EXCLUDED.quantity`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          } as any)
        )
        .execute();

      return true;
    } catch (error) {
      console.error("Error upserting holding:", error);
      return false;
    }
  }

  /**
   * Set holding quantity to a specific value
   */
  async setHoldingQuantity(
    portfolioId: string,
    marketId: string,
    quantity: number,
    userId?: string,
  ): Promise<boolean> {
    try {
      // Get userId if not provided
      let finalUserId = userId;
      if (!finalUserId) {
        const fetchedUserId = await this.getUserIdFromPortfolioId(portfolioId);
        if (!fetchedUserId) {
          console.error("Error: Could not get user_id for portfolio", portfolioId);
          return false;
        }
        finalUserId = fetchedUserId;
      }

      await this.kysely
        .insertInto('holdings')
        .values({
          portfolio_id: portfolioId,
          user_id: finalUserId,
          market_id: marketId,
          quantity: quantity.toString(),
          average_cost_basis: '0',
          total_cost: '0',
        } as any)
        .onConflict((oc) => 
          oc.columns(['portfolio_id', 'market_id']).doUpdateSet({
            quantity: quantity.toString(),
            updated_at: sql`CURRENT_TIMESTAMP`,
          } as any)
        )
        .execute();

      return true;
    } catch (error) {
      console.error("Error setting holding quantity:", error);
      return false;
    }
  }

  /**
   * Adjust holding quantity by a delta amount (can be negative)
   * Includes quantity check to prevent negative holdings
   */
  async adjustHoldingQuantity(
    portfolioId: string,
    marketId: string,
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
          .where('portfolio_id', '=', portfolioId)
          .where('market_id', '=', marketId)
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
          .where('portfolio_id', '=', portfolioId)
          .where('market_id', '=', marketId)
          .executeTakeFirst();

        // If no existing holding, create a new one
        if (Number(result.numUpdatedRows) === 0) {
          // Get userId from portfolio
          const fetchedUserId = await this.getUserIdFromPortfolioId(portfolioId, trx);
          if (!fetchedUserId) {
            console.error("Error: Could not get user_id for portfolio", portfolioId);
            return false;
          }

          await db
            .insertInto('holdings')
            .values({
              portfolio_id: portfolioId,
              user_id: fetchedUserId,
              market_id: marketId,
              quantity: deltaQuantity.toString(),
              average_cost_basis: '0',
              total_cost: '0',
            } as any)
            .execute();
        }
        return true;
      }
    } catch (error) {
      console.error("Error adjusting holding quantity:", error);
      return false;
    }
  }

  /**
   * Atomically check and reserve holding quantity (for order placement)
   * Returns true if reservation successful, false if insufficient quantity
   */
  async reserveHolding(
    portfolioId: string,
    marketId: string,
    quantity: number,
  ): Promise<boolean> {
    try {
      // First, ensure the holding exists (create with 0 if it doesn't)
      await this.getOrCreateHoldingId(portfolioId, marketId);
      
      // Then try to reserve (deduct) the quantity atomically
      // This will only succeed if the holding has sufficient quantity
      // Use string comparison since quantity is stored as numeric (string) type
      const quantityStr = quantity.toString();
      const result = await this.kysely
        .updateTable('holdings')
        .set({
          quantity: sql`quantity - ${quantityStr}::numeric`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where('portfolio_id', '=', portfolioId)
        .where('market_id', '=', marketId)
        .where('quantity', '>=', quantityStr) // Atomic check - must have enough (string comparison works for numeric types)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        // No rows updated means insufficient holdings
        console.error(`Failed to reserve holding: insufficient quantity. Portfolio: ${portfolioId}, Market: ${marketId}, Required: ${quantity}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error reserving holding:", error);
      return false;
    }
  }

  /**
   * Delete holdings with zero or negative quantity
   */
  async cleanupZeroHoldings(portfolioId?: string): Promise<number> {
    try {
      let query = this.kysely
        .deleteFrom('holdings')
        .where('quantity', '<=', '0');

      if (portfolioId) {
        query = query.where('portfolio_id', '=', portfolioId);
      }

      const result = await query.executeTakeFirst();
      return Number(result.numDeletedRows) || 0;
    } catch (error) {
      console.error("Error cleaning up zero holdings:", error);
      return 0;
    }
  }

  /**
   * Delete all holdings for a portfolio
   */
  async deletePortfolioHoldings(portfolioId: string): Promise<boolean> {
    try {
      await this.kysely
        .deleteFrom('holdings')
        .where('portfolio_id', '=', portfolioId)
        .execute();

      return true;
    } catch (error) {
      console.error("Error deleting portfolio holdings:", error);
      return false;
    }
  }


  /**
   * Map database record to HoldingDto
   */
  private mapRecordToDto(record: any): HoldingDto {
    const dto = new HoldingDto();
    dto.id = record.id;
    dto.portfolioId = record.portfolio_id;
    dto.userId = record.user_id;
    dto.marketId = record.market_id;
    dto.quantity = parseFloat(record.quantity);
    dto.averageCostBasis = record.average_cost_basis ? parseFloat(record.average_cost_basis) : undefined;
    dto.totalCost = record.total_cost ? parseFloat(record.total_cost) : undefined;
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    return dto;
  }

  /**
   * Map database record with market data to HoldingDto
   */
  private mapRecordWithMarketToDto(record: any): HoldingDto {
    const dto = new HoldingDto();
    dto.id = record.id;
    dto.portfolioId = record.portfolio_id;
    dto.userId = record.user_id;
    dto.marketId = record.market_id;
    dto.marketSymbol = record.market_symbol;
    dto.marketName = record.market_name;
    dto.quantity = parseFloat(record.quantity);
    dto.averageCostBasis = record.average_cost_basis ? parseFloat(record.average_cost_basis) : undefined;
    dto.totalCost = record.total_cost ? parseFloat(record.total_cost) : undefined;
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    return dto;
  }

  /**
   * Update cost basis when buying holdings (weighted average)
   * When buying: new_average = (old_total_cost + new_cost) / (old_quantity + new_quantity)
   */
  async updateCostBasisOnPurchase(
    portfolioId: string,
    marketId: string,
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
        .where('portfolio_id', '=', portfolioId)
        .where('market_id', '=', marketId)
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
          .where('portfolio_id', '=', portfolioId)
          .where('market_id', '=', marketId)
          .executeTakeFirst();
        return Number(result.numUpdatedRows) > 0;
      }

      const oldQuantity = parseFloat(current.quantity);
      const oldTotalCost = parseFloat(current.total_cost || '0');
      const oldAverageCostBasis = parseFloat(current.average_cost_basis || '0');
      
      // If existing holding has no cost basis (0), treat the existing quantity as if it was just purchased
      // This handles the case where holdings were created without cost basis (e.g., test data)
      // We'll set the cost basis to the purchase price for all holdings
      let newQuantity: number;
      let newTotalCost: number;
      let newAverageCostBasis: number;
      
      // Note: adjustHoldingQuantity is called before this method, so oldQuantity already includes the purchaseQuantity
      // We need to subtract purchaseQuantity to get the original quantity before the purchase
      const originalQuantity = Math.max(0, oldQuantity - purchaseQuantity);
      
      if (oldAverageCostBasis > 0) {
        // Normal case: existing holding has cost basis, calculate weighted average
        // oldQuantity already includes the purchase, so we use it directly
        const originalTotalCost = originalQuantity > 0 ? (originalQuantity * oldAverageCostBasis) : 0;
        newQuantity = oldQuantity; // Already includes purchase
        newTotalCost = originalTotalCost + purchaseCost;
        newAverageCostBasis = newQuantity > 0 ? newTotalCost / newQuantity : 0;
      } else if (originalQuantity > 0) {
        // Special case: existing holding had no cost basis but had quantity
        // Set cost basis to purchase price for all holdings
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
        .where('portfolio_id', '=', portfolioId)
        .where('market_id', '=', marketId)
        .executeTakeFirst();

      return Number(result.numUpdatedRows) > 0;
    } catch (error) {
      console.error("Error updating cost basis on purchase:", error);
      return false;
    }
  }

  /**
   * Update cost basis when selling holdings (FIFO - first in, first out)
   * When selling, we don't change the average cost basis, just reduce total_cost proportionally
   */
  async updateCostBasisOnSale(
    portfolioId: string,
    marketId: string,
    saleQuantity: number,
    trx?: any,
  ): Promise<boolean> {
    try {
      const db = trx || this.kysely;

      // Get current holding
      const current = await db
        .selectFrom('holdings')
        .select(['quantity', 'average_cost_basis', 'total_cost'])
        .where('portfolio_id', '=', portfolioId)
        .where('market_id', '=', marketId)
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
        .where('portfolio_id', '=', portfolioId)
        .where('market_id', '=', marketId)
        .executeTakeFirst();

      return Number(result.numUpdatedRows) > 0;
    } catch (error) {
      console.error("Error updating cost basis on sale:", error);
      return false;
    }
  }
}
