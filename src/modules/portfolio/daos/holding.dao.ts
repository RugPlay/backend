import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { HoldingDto } from "../dtos/holding.dto";
import { sql } from "kysely";

@Injectable()
export class HoldingDao extends KyselyDao<HoldingDao> {

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
          'holdings.market_id',
          'holdings.quantity',
          'holdings.created_at',
          'holdings.updated_at',
          'markets.symbol as market_symbol',
          'markets.name as market_name',
        ])
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
   * Create or update a holding quantity
   */
  async upsertHolding(
    portfolioId: string,
    marketId: string,
    quantity: number,
  ): Promise<boolean> {
    try {
      await this.kysely
        .insertInto('holdings')
        .values({
          portfolio_id: portfolioId,
          market_id: marketId,
          quantity: quantity.toString(),
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
  ): Promise<boolean> {
    try {
      await this.kysely
        .insertInto('holdings')
        .values({
          portfolio_id: portfolioId,
          market_id: marketId,
          quantity: quantity.toString(),
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
          await db
            .insertInto('holdings')
            .values({
              portfolio_id: portfolioId,
              market_id: marketId,
              quantity: deltaQuantity.toString(),
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
      const result = await this.kysely
        .updateTable('holdings')
        .set({
          quantity: sql`quantity - ${quantity.toString()}`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where('portfolio_id', '=', portfolioId)
        .where('market_id', '=', marketId)
        .where('quantity', '>=', quantity.toString()) // Atomic check
        .executeTakeFirst();

      return result.numUpdatedRows > 0;
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
   * Delete all holdings (for testing)
   */
  async deleteAllHoldings(): Promise<boolean> {
    try {
      await this.kysely
        .deleteFrom('holdings')
        .execute();
      return true;
    } catch (error) {
      console.error("Error deleting all holdings:", error);
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
    dto.marketId = record.market_id;
    dto.quantity = parseFloat(record.quantity);
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
    dto.marketId = record.market_id;
    dto.marketSymbol = record.market_symbol;
    dto.marketName = record.market_name;
    dto.quantity = parseFloat(record.quantity);
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    return dto;
  }
}
