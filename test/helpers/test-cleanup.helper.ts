import { INestApplication } from '@nestjs/common';
import { OrderService } from '../../src/modules/exchange/services/order.service';
import { MarketService } from '../../src/modules/exchange/services/market.service';
import { PortfolioService } from '../../src/modules/portfolio/services/portfolio.service';
import { HoldingDao } from '../../src/modules/portfolio/daos/holding.dao';
import { PortfolioDao } from '../../src/modules/portfolio/daos/portfolio.dao';
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
    const holdingDao = app.get(HoldingDao);
    const kysely = (holdingDao as any).kysely as Kysely<DB>;

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
      await kysely.deleteFrom('portfolios').execute();
      await kysely.deleteFrom('markets').execute();
      
      // Re-enable foreign key checks
      await sql`SET session_replication_role = DEFAULT`.execute(kysely);
    } catch (error) {
      console.error('Error during test cleanup:', error);
    }
  }

  /**
   * Create a test portfolio with sufficient balance
   */
  static async createTestPortfolio(
    app: INestApplication,
    userId: string = 'test-user-id',
    balance: number = 1000000
  ): Promise<string> {
    const portfolioService = app.get(PortfolioService);
    
    const portfolioDto = await portfolioService.createPortfolio(userId, {
      balance,
      type: 'real',
    });

    if (!portfolioDto || !portfolioDto.id) {
      throw new Error('Failed to create test portfolio');
    }

    return portfolioDto.id;
  }

  /**
   * Create a test holding for a portfolio
   */
  static async createTestHolding(
    app: INestApplication,
    portfolioId: string,
    marketId: string,
    quantity: number
  ): Promise<void> {
    const holdingDao = app.get(HoldingDao);
    
    const success = await holdingDao.adjustHoldingQuantity(
      portfolioId,
      marketId,
      quantity,
    );

    if (!success) {
      throw new Error(`Failed to create test holding for portfolio ${portfolioId} in market ${marketId}`);
    }
  }

  /**
   * Ensure portfolio has at least the specified balance, adding more if needed
   */
  static async ensureMinimumBalance(
    app: INestApplication,
    portfolioId: string,
    minimumBalance: number
  ): Promise<void> {
    const portfolioDao = app.get(PortfolioDao);
    const currentBalance = await portfolioDao.getBalanceByPortfolioId(portfolioId);
    
    if (currentBalance === null) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    if (currentBalance < minimumBalance) {
      const needed = minimumBalance - currentBalance;
      const success = await portfolioDao.adjustBalanceByPortfolioId(portfolioId, needed);
      if (!success) {
        throw new Error(`Failed to adjust balance for portfolio ${portfolioId}`);
      }
    }
  }

  /**
   * Reset portfolio balance to a specific amount
   * This is useful for tests that need a known starting state
   */
  static async resetPortfolioBalance(
    app: INestApplication,
    portfolioId: string,
    targetBalance: number
  ): Promise<void> {
    const portfolioDao = app.get(PortfolioDao);
    const currentBalance = await portfolioDao.getBalanceByPortfolioId(portfolioId);
    
    if (currentBalance === null) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    const difference = targetBalance - currentBalance;
    if (Math.abs(difference) > 0.01) {
      const success = await portfolioDao.adjustBalanceByPortfolioId(portfolioId, difference);
      if (!success) {
        throw new Error(`Failed to reset balance for portfolio ${portfolioId} to ${targetBalance}`);
      }
    }
  }

  /**
   * Clear all holdings for a portfolio
   */
  static async clearPortfolioHoldings(
    app: INestApplication,
    portfolioId: string
  ): Promise<void> {
    const holdingDao = app.get(HoldingDao);
    await holdingDao.deletePortfolioHoldings(portfolioId);
  }

  /**
   * Reset portfolio to a clean state (balance and holdings)
   */
  static async resetPortfolio(
    app: INestApplication,
    portfolioId: string,
    targetBalance: number
  ): Promise<void> {
    await this.clearPortfolioHoldings(app, portfolioId);
    await this.resetPortfolioBalance(app, portfolioId, targetBalance);
  }
}
