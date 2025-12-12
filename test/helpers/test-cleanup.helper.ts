import { INestApplication } from '@nestjs/common';
import { OrderService } from '../../src/modules/exchange/services/order.service';
import { MarketService } from '../../src/modules/exchange/services/market.service';
import { PortfolioService } from '../../src/modules/portfolio/services/portfolio.service';
import { TradeDao } from '../../src/modules/exchange/daos/trade.dao';
import { OrderDao } from '../../src/modules/exchange/daos/order.dao';
import { HoldingDao } from '../../src/modules/portfolio/daos/holding.dao';
import { PortfolioDao } from '../../src/modules/portfolio/daos/portfolio.dao';
import { MarketDao } from '../../src/modules/exchange/daos/market.dao';
import { REDIS_CLIENT } from '../../src/redis/constants/redis.constants';
import { DATABASE_POOL } from '../../src/postgres/constants/postgres.constants';
import Redis from 'ioredis';
import { Pool } from 'pg';

export class TestCleanupHelper {
  /**
   * Clean up all test data from database and Redis
   */
  static async cleanupTestData(app: INestApplication): Promise<void> {
    const orderService = app.get(OrderService);
    const tradeDao = app.get(TradeDao);
    const orderDao = app.get(OrderDao);
    const holdingDao = app.get(HoldingDao);
    const portfolioDao = app.get(PortfolioDao);
    const marketDao = app.get(MarketDao);

    try {
      // Clear Redis data
      await orderService.clearAllRedisData();

      // Clear database tables using DAOs (in correct order respecting foreign keys)
      // Delete in order: trades -> orders -> holdings -> portfolios -> markets
      await tradeDao.deleteAllTrades();
      await orderDao.deleteAllOrders();
      await holdingDao.deleteAllHoldings();
      await portfolioDao.deleteAllPortfolios();
      await marketDao.deleteAllMarkets();

      console.log('Test cleanup completed successfully');
    } catch (error) {
      console.error('Error during test cleanup:', error);
    }
  }

  /**
   * Close all connections to prevent Jest from hanging
   */
  static async closeAllConnections(app: INestApplication): Promise<void> {
    try {
      // Get Redis client and close connection
      const redisClient = app.get<Redis>(REDIS_CLIENT);
      if (redisClient && redisClient.status === 'ready') {
        await redisClient.quit();
        console.log('Redis connection closed');
      }

      // Get PostgreSQL pool and close all connections
      const pgPool = app.get<Pool>(DATABASE_POOL);
      if (pgPool) {
        await pgPool.end();
        console.log('PostgreSQL pool closed');
      }

      console.log('All connections closed successfully');
    } catch (error) {
      console.error('Error closing connections:', error);
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
}
