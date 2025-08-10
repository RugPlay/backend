import { Injectable } from "@nestjs/common";
import { KnexDao } from "@/database/knex/knex.dao";
import { CreatePortfolioDto } from "../dtos/create-portfolio.dto";
import { PortfolioDto } from "../dtos/portfolio.dto";

@Injectable()
export class PortfolioDao extends KnexDao<PortfolioDao> {
  protected readonly tableName = "portfolios";

  /**
   * Create a new portfolio for a user
   */
  async createPortfolio(
    userId: string,
    portfolio: CreatePortfolioDto,
  ): Promise<string | null> {
    try {
      const [result] = await this.knex(this.tableName)
        .insert({
          user_id: userId,
          balance: (portfolio.balance || 0).toString(),
        })
        .returning("id");

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
      const portfolio = await this.knex(this.tableName)
        .where("user_id", userId)
        .first();

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
   * Update portfolio balance
   */
  async updateBalance(userId: string, newBalance: number): Promise<boolean> {
    try {
      const updated = await this.knex(this.tableName)
        .where("user_id", userId)
        .update({
          balance: newBalance.toString(),
          updated_at: this.knex.fn.now(),
        });

      return updated > 0;
    } catch (error) {
      console.error("Error updating portfolio balance:", error);
      return false;
    }
  }

  /**
   * Add amount to portfolio balance (can be negative for deduction)
   */
  async adjustBalance(userId: string, amount: number): Promise<boolean> {
    try {
      const updated = await this.knex(this.tableName)
        .where("user_id", userId)
        .update({
          balance: this.knex.raw("balance + ?", [amount.toString()]),
          updated_at: this.knex.fn.now(),
        });

      return updated > 0;
    } catch (error) {
      console.error("Error adjusting portfolio balance:", error);
      return null;
    }
  }

  /**
   * Add amount to portfolio balance by portfolio ID (can be negative for deduction)
   * Includes balance check to prevent negative balances
   */
  async adjustBalanceByPortfolioId(portfolioId: string, amount: number): Promise<boolean> {
    try {
      const updated = await this.knex(this.tableName)
        .where("id", portfolioId)
        .where("balance", ">=", Math.abs(amount < 0 ? amount : 0)) // Prevent negative balance
        .update({
          balance: this.knex.raw("balance + ?", [amount.toString()]),
          updated_at: this.knex.fn.now(),
        });

      return updated > 0;
    } catch (error) {
      console.error("Error adjusting portfolio balance by portfolio ID:", error);
      return false;
    }
  }

  /**
   * Atomically check balance and reserve amount (for order placement)
   * Returns true if reservation successful, false if insufficient balance
   */
  async reserveBalance(portfolioId: string, amount: number): Promise<boolean> {
    try {
      const updated = await this.knex(this.tableName)
        .where("id", portfolioId)
        .where("balance", ">=", amount) // Atomic check
        .update({
          balance: this.knex.raw("balance - ?", [amount.toString()]),
          updated_at: this.knex.fn.now(),
        });

      return updated > 0;
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
      const result = await this.knex(this.tableName)
        .select("balance")
        .where("user_id", userId)
        .first();

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
      const result = await this.knex(this.tableName)
        .select("balance")
        .where("id", portfolioId)
        .first();

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
      const deleted = await this.knex(this.tableName)
        .where("user_id", userId)
        .del();

      return deleted > 0;
    } catch (error) {
      console.error("Error deleting portfolio:", error);
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
    dto.holdings = []; // Holdings should be loaded separately via service layer
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    return dto;
  }
}
