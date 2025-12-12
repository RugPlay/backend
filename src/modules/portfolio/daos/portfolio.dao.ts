import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { CreatePortfolioDto } from "../dtos/create-portfolio.dto";
import { PortfolioDto } from "../dtos/portfolio.dto";
import { sql } from "kysely";

@Injectable()
export class PortfolioDao extends KyselyDao<PortfolioDao> {

  /**
   * Create a new portfolio for a user
   */
  async createPortfolio(
    userId: string,
    portfolio: CreatePortfolioDto,
    trx?: any,
  ): Promise<string | null> {
    try {
      const db = trx || this.kysely;
      const result = await db
        .insertInto('portfolios')
        .values({
          user_id: userId,
          balance: (portfolio.balance || 0).toString(),
          type: portfolio.type || 'real',
        } as any)
        .returning('id')
        .executeTakeFirst();

      return result?.id || null;
    } catch (error) {
      console.error("Error creating portfolio:", error);
      return null;
    }
  }

  /**
   * Get a portfolio by user ID
   */
  async getPortfolioByUserId(userId: string): Promise<PortfolioDto | null> {
    try {
      const portfolio = await this.kysely
        .selectFrom('portfolios')
        .selectAll()
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!portfolio) {
        return null;
      }

      return this.mapRecordToDto(portfolio);
    } catch (error) {
      console.error("Error getting portfolio by user ID:", error);
      return null;
    }
  }

  /**
   * Get a portfolio by portfolio ID
   */
  async getPortfolioById(portfolioId: string, trx?: any): Promise<PortfolioDto | null> {
    try {
      const db = trx || this.kysely;
      const portfolio = await db
        .selectFrom('portfolios')
        .selectAll()
        .where('id', '=', portfolioId)
        .executeTakeFirst();

      if (!portfolio) {
        return null;
      }

      return this.mapRecordToDto(portfolio);
    } catch (error) {
      console.error("Error getting portfolio by ID:", error);
      return null;
    }
  }

  /**
   * Update portfolio balance
   */
  async updateBalance(userId: string, newBalance: number, trx?: any): Promise<boolean> {
    try {
      const db = trx || this.kysely;
      const result = await db
        .updateTable('portfolios')
        .set({
          balance: newBalance.toString(),
          updated_at: sql`CURRENT_TIMESTAMP`,
        } as any)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error updating portfolio balance:", error);
      return false;
    }
  }

  /**
   * Add amount to portfolio balance (can be negative for deduction)
   */
  async adjustBalance(userId: string, amount: number, trx?: any): Promise<boolean> {
    try {
      const db = trx || this.kysely;
      const result = await db
        .updateTable('portfolios')
        .set({
          balance: sql`balance + ${amount.toString()}`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where('user_id', '=', userId)
        .executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error adjusting portfolio balance:", error);
      return false;
    }
  }

  /**
   * Add amount to portfolio balance by portfolio ID (can be negative for deduction)
   * Includes balance check to prevent negative balances
   */
  async adjustBalanceByPortfolioId(
    portfolioId: string,
    amount: number,
  ): Promise<boolean> {
    try {
      const minBalance = amount < 0 ? Math.abs(amount) : 0;
      const result = await this.kysely
        .updateTable('portfolios')
        .set({
          balance: sql`balance + ${amount.toString()}`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where('id', '=', portfolioId)
        .where('balance', '>=', minBalance.toString()) // Prevent negative balance
        .executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error(
        "Error adjusting portfolio balance by portfolio ID:",
        error,
      );
      return false;
    }
  }

  /**
   * Atomically check balance and reserve amount (for order placement)
   * Returns true if reservation successful, false if insufficient balance
   */
  async reserveBalance(portfolioId: string, amount: number): Promise<boolean> {
    try {
      const result = await this.kysely
        .updateTable('portfolios')
        .set({
          balance: sql`balance - ${amount.toString()}`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where('id', '=', portfolioId)
        .where('balance', '>=', amount.toString()) // Atomic check
        .executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error reserving balance:", error);
      return false;
    }
  }

  /**
   * Get portfolio balance
   */
  async getBalance(userId: string): Promise<number | null> {
    try {
      const result = await this.kysely
        .selectFrom('portfolios')
        .select('balance')
        .where('user_id', '=', userId)
        .executeTakeFirst();

      return result ? parseFloat(result.balance) : null;
    } catch (error) {
      console.error("Error getting portfolio balance:", error);
      return null;
    }
  }

  /**
   * Get portfolio balance by portfolio ID
   */
  async getBalanceByPortfolioId(portfolioId: string): Promise<number | null> {
    try {
      const result = await this.kysely
        .selectFrom('portfolios')
        .select('balance')
        .where('id', '=', portfolioId)
        .executeTakeFirst();

      return result ? parseFloat(result.balance) : null;
    } catch (error) {
      console.error("Error getting portfolio balance by portfolio ID:", error);
      return null;
    }
  }

  /**
   * Delete a portfolio by user ID
   */
  async deletePortfolio(userId: string): Promise<boolean> {
    try {
      const result = await this.kysely
        .deleteFrom('portfolios')
        .where('user_id', '=', userId)
        .executeTakeFirst();

      return result.numDeletedRows > 0;
    } catch (error) {
      console.error("Error deleting portfolio:", error);
      return false;
    }
  }

  /**
   * Delete all portfolios (for testing)
   */
  async deleteAllPortfolios(): Promise<boolean> {
    try {
      await this.kysely
        .deleteFrom('portfolios')
        .execute();
      return true;
    } catch (error) {
      console.error("Error deleting all portfolios:", error);
      return false;
    }
  }

  /**
   * Map database record to PortfolioDto
   */
  private mapRecordToDto(record: any): PortfolioDto {
    const dto = new PortfolioDto();
    dto.id = record.id;
    dto.userId = record.user_id;
    dto.balance = parseFloat(record.balance);
    dto.type = record.type || "real"; // Default to real if not specified
    dto.holdings = []; // Holdings should be loaded separately via service layer
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    return dto;
  }
}
