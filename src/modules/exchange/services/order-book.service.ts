import { Injectable, Logger, Inject, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS_CLIENT } from "@/redis/constants/redis.constants";
import { OrderDao } from "../daos/order.dao";
import { OrderMatchingService } from "./order-matching.service";
import { OrderBookEntryDto } from "../dtos/order-book/order-book-entry.dto";
import { OrderBookDto } from "../dtos/order-book/order-book.dto";
import { OrderMatchingResultDto } from "../dtos/order-matching/order-matching-result.dto";

@Injectable()
export class OrderBookService implements OnModuleInit {
  private readonly logger = new Logger(OrderBookService.name);
  private readonly ORDER_BOOK_PREFIX = "orderbook:";
  private readonly ORDER_PREFIX = "order:";
  private readonly MARKET_IDS_KEY = "orderbook:markets";

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly orderDao: OrderDao,
    private readonly orderMatchingService: OrderMatchingService,
  ) {}

  async onModuleInit() {
    await this.restoreOrderBookFromDatabase();
  }

  /**
   * Restore all order books from the database on startup
   */
  private async restoreOrderBookFromDatabase(): Promise<void> {
    try {
      const marketIds = await this.orderDao.getMarketIds();

      for (const marketId of marketIds) {
        await this.restoreOrderBookForMarket(marketId);
      }

      this.logger.log(`Restored ${marketIds.length} order books from Redis`);
    } catch (error) {
      this.logger.error("Error restoring order books from database:", error);
    }
  }

  /**
   * Restore order book for a specific market from database
   */
  private async restoreOrderBookForMarket(marketId: string): Promise<void> {
    try {
      const orders = await this.orderDao.getOrdersByMarket(marketId);

      // Store orders in Redis
      for (const order of orders) {
        const orderKey = `${this.ORDER_PREFIX}${order.id}`;
        const orderData = {
          marketId: order.market_id,
          price: parseFloat(order.price),
          quantity: parseFloat(order.quantity),
          timestamp: order.created_at.toISOString(),
          orderId: order.id,
          side: order.side,
        };

        await this.redis.set(orderKey, JSON.stringify(orderData));

        // Add to sorted sets for price-based queries
        const score = order.side === "bid" ? -order.price : order.price; // Negative for bids to maintain descending order
        await this.redis.zadd(
          `${this.ORDER_BOOK_PREFIX}${marketId}:${order.side}`,
          score,
          order.id,
        );
      }

      // Store market ID in the set of all markets
      await this.redis.sadd(this.MARKET_IDS_KEY, marketId);

      this.logger.debug(
        `Restored order book for market ${marketId}: ${orders.length} orders`,
      );
    } catch (error) {
      this.logger.error(
        `Error restoring order book for market ${marketId}:`,
        error,
      );
    }
  }

  /**
   * Create a new order book for a market
   */
  async createOrderBook(marketId: string): Promise<OrderBookDto> {
    // Add market to the set of all markets
    await this.redis.sadd(this.MARKET_IDS_KEY, marketId);

    const orderBook: OrderBookDto = {
      marketId,
      bids: [],
      asks: [],
      lastUpdated: new Date(),
    };

    this.logger.log(`Created order book for market: ${marketId}`);
    return orderBook;
  }

  /**
   * Get an existing order book for a market
   */
  async getOrderBook(marketId: string): Promise<OrderBookDto | null> {
    const exists =
      (await this.redis.sismember(this.MARKET_IDS_KEY, marketId)) === 1;
    if (!exists) {
      return null;
    }

    const bids = await this.getOrdersBySide(marketId, "bid");
    const asks = await this.getOrdersBySide(marketId, "ask");

    return {
      marketId,
      bids,
      asks,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get orders by side for a market
   */
  private async getOrdersBySide(
    marketId: string,
    side: "bid" | "ask",
  ): Promise<OrderBookEntryDto[]> {
    const orderIds = await this.redis.zrange(
      `${this.ORDER_BOOK_PREFIX}${marketId}:${side}`,
      0,
      -1,
    );
    const orders: OrderBookEntryDto[] = [];

    for (const orderId of orderIds) {
      const orderData = await this.redis.get(`${this.ORDER_PREFIX}${orderId}`);
      if (orderData) {
        orders.push(JSON.parse(orderData));
      }
    }

    return orders;
  }

  /**
   * Add a new order to the order book with matching and persist to database and Redis
   * Now with atomic transaction safety and Redis recovery
   */
  async addOrderWithMatching(
    marketId: string,
    order: Omit<OrderBookEntryDto, "timestamp">,
  ): Promise<OrderMatchingResultDto> {
    let matchingResult: OrderMatchingResultDto | null = null;

    try {
      // Attempt to match the order first (this includes database transaction)
      matchingResult = await this.orderMatchingService.processOrderMatching({
        marketId,
        incomingOrder: order,
      });

      // Process the matching results in Redis (with retry and recovery)
      await this.processMatchingResultsSafely(marketId, matchingResult);

      this.logger.debug(
        `Order matching completed for market ${marketId}: ${matchingResult.matches.length} matches, ` +
          `${matchingResult.completedOrderIds.length} completed orders, ` +
          `${matchingResult.updatedOrders.length} updated orders`,
      );

      return matchingResult;
    } catch (error) {
      this.logger.error(
        `Error processing order with matching for market ${marketId}:`,
        error,
      );

      // If we have a partial matching result but Redis failed, try to recover
      if (matchingResult) {
        this.logger.warn(
          `Database operations succeeded but Redis sync failed for market ${marketId}. ` +
            `Attempting recovery...`,
        );

        // Attempt Redis recovery in background
        setImmediate(async () => {
          await this.attemptRedisRecovery(marketId, matchingResult!);
        });

        // Return the successful matching result despite Redis issues
        return matchingResult;
      }

      // Complete failure - fallback to adding order without matching
      const success = await this.addOrder(marketId, order);
      return {
        matches: [],
        remainingOrder: success ? { ...order, timestamp: new Date() } : null,
        updatedOrders: [],
        completedOrderIds: [],
      };
    }
  }

  /**
   * Add a new order to the order book and persist to database and Redis (without matching)
   */
  async addOrder(
    marketId: string,
    order: Omit<OrderBookEntryDto, "timestamp">,
  ): Promise<boolean> {
    try {
      // Persist order to database first
      const dbOrderId = await this.orderDao.createOrder({
        ...order,
        marketId,
      });

      if (!dbOrderId) {
        this.logger.error(
          `Failed to persist order to database for market: ${marketId}`,
        );
        return false;
      }

      // Create order entry with database ID and timestamp
      const orderWithTimestamp: OrderBookEntryDto = {
        ...order,
        orderId: dbOrderId,
        timestamp: new Date(),
      };

      // Store order in Redis
      const orderKey = `${this.ORDER_PREFIX}${dbOrderId}`;
      await this.redis.set(orderKey, JSON.stringify(orderWithTimestamp));

      // Add to sorted set for price-based queries
      const score = order.side === "bid" ? -order.price : order.price; // Negative for bids to maintain descending order
      await this.redis.zadd(
        `${this.ORDER_BOOK_PREFIX}${marketId}:${order.side}`,
        score,
        dbOrderId,
      );

      // Ensure market is in the set of all markets
      await this.redis.sadd(this.MARKET_IDS_KEY, marketId);

      this.logger.debug(
        `Added ${order.side} order to market ${marketId}: ${order.quantity} @ ${order.price}`,
      );

      return true;
    } catch (error) {
      this.logger.error(`Error adding order to market ${marketId}:`, error);
      return false;
    }
  }

  /**
   * Remove an order from the order book, database, and Redis
   */
  async removeOrder(
    marketId: string,
    orderId: string,
    side: "bid" | "ask",
  ): Promise<boolean> {
    try {
      // Remove from database first
      const dbRemoved = await this.orderDao.deleteOrder(orderId);
      if (!dbRemoved) {
        this.logger.warn(
          `Order ${orderId} not found in database for market ${marketId}`,
        );
        return false;
      }

      // Remove from Redis sorted set
      await this.redis.zrem(
        `${this.ORDER_BOOK_PREFIX}${marketId}:${side}`,
        orderId,
      );

      // Remove order data from Redis
      await this.redis.del(`${this.ORDER_PREFIX}${orderId}`);

      this.logger.debug(
        `Removed ${side} order ${orderId} from market ${marketId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error removing order ${orderId} from market ${marketId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get the best bid (highest price)
   */
  async getBestBid(marketId: string): Promise<OrderBookEntryDto | null> {
    const orderIds = await this.redis.zrange(
      `${this.ORDER_BOOK_PREFIX}${marketId}:bid`,
      0,
      0,
    );
    if (orderIds.length === 0) {
      return null;
    }

    const orderData = await this.redis.get(
      `${this.ORDER_PREFIX}${orderIds[0]}`,
    );
    return orderData ? JSON.parse(orderData) : null;
  }

  /**
   * Get the best ask (lowest price)
   */
  async getBestAsk(marketId: string): Promise<OrderBookEntryDto | null> {
    const orderIds = await this.redis.zrange(
      `${this.ORDER_BOOK_PREFIX}${marketId}:ask`,
      0,
      0,
    );
    if (orderIds.length === 0) {
      return null;
    }

    const orderData = await this.redis.get(
      `${this.ORDER_PREFIX}${orderIds[0]}`,
    );
    return orderData ? JSON.parse(orderData) : null;
  }

  /**
   * Get the spread between best bid and ask
   */
  async getSpread(marketId: string): Promise<number | null> {
    const bestBid = await this.getBestBid(marketId);
    const bestAsk = await this.getBestAsk(marketId);

    if (!bestBid || !bestAsk) {
      return null;
    }

    return bestAsk.price - bestBid.price;
  }

  /**
   * Get order book depth up to a specified number of levels
   */
  async getDepth(
    marketId: string,
    levels: number = 10,
  ): Promise<{ bids: OrderBookEntryDto[]; asks: OrderBookEntryDto[] } | null> {
    const exists =
      (await this.redis.sismember(this.MARKET_IDS_KEY, marketId)) === 1;
    if (!exists) {
      return null;
    }

    const bidIds = await this.redis.zrange(
      `${this.ORDER_BOOK_PREFIX}${marketId}:bid`,
      0,
      levels - 1,
    );
    const askIds = await this.redis.zrange(
      `${this.ORDER_BOOK_PREFIX}${marketId}:ask`,
      0,
      levels - 1,
    );

    const bids = await this.getOrdersByIds(bidIds);
    const asks = await this.getOrdersByIds(askIds);

    return { bids, asks };
  }

  /**
   * Get orders by IDs
   */
  private async getOrdersByIds(
    orderIds: string[],
  ): Promise<OrderBookEntryDto[]> {
    const orders: OrderBookEntryDto[] = [];

    for (const orderId of orderIds) {
      const orderData = await this.redis.get(`${this.ORDER_PREFIX}${orderId}`);
      if (orderData) {
        orders.push(JSON.parse(orderData));
      }
    }

    return orders;
  }

  /**
   * Get total quantity at a specific price level
   */
  async getQuantityAtPrice(
    marketId: string,
    price: number,
    side: "bid" | "ask",
  ): Promise<number> {
    const orderIds = await this.redis.zrange(
      `${this.ORDER_BOOK_PREFIX}${marketId}:${side}`,
      0,
      -1,
    );
    let totalQuantity = 0;

    for (const orderId of orderIds) {
      const orderData = await this.redis.get(`${this.ORDER_PREFIX}${orderId}`);
      if (orderData) {
        const order = JSON.parse(orderData);
        if (order.price === price) {
          totalQuantity += order.quantity;
        }
      }
    }

    return totalQuantity;
  }

  /**
   * Clear all orders from a market's order book, database, and Redis
   */
  async clearOrderBook(marketId: string): Promise<boolean> {
    try {
      // Clear from database first
      await this.orderDao.deleteOrdersByMarket(marketId);

      // Clear from Redis
      await this.redis.del(`${this.ORDER_BOOK_PREFIX}${marketId}:bid`);
      await this.redis.del(`${this.ORDER_BOOK_PREFIX}${marketId}:ask`);

      // Remove market from the set of all markets
      await this.redis.srem(this.MARKET_IDS_KEY, marketId);

      this.logger.log(`Cleared order book for market: ${marketId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error clearing order book for market ${marketId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get all market IDs that have order books
   */
  async getMarketIds(): Promise<string[]> {
    return await this.redis.smembers(this.MARKET_IDS_KEY);
  }

  /**
   * Check if an order book exists for a market
   */
  async hasOrderBook(marketId: string): Promise<boolean> {
    return (await this.redis.sismember(this.MARKET_IDS_KEY, marketId)) === 1;
  }

  /**
   * Force refresh of an order book from database
   */
  async refreshOrderBook(marketId: string): Promise<boolean> {
    try {
      // Clear existing Redis data for this market
      await this.redis.del(`${this.ORDER_BOOK_PREFIX}${marketId}:bid`);
      await this.redis.del(`${this.ORDER_BOOK_PREFIX}${marketId}:ask`);

      // Restore from database
      await this.restoreOrderBookForMarket(marketId);

      return await this.hasOrderBook(marketId);
    } catch (error) {
      this.logger.error(
        `Error refreshing order book for market ${marketId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get order book statistics
   */
  async getOrderBookStats(marketId: string): Promise<{
    totalBids: number;
    totalAsks: number;
    totalBidQuantity: number;
    totalAskQuantity: number;
  } | null> {
    const exists =
      (await this.redis.sismember(this.MARKET_IDS_KEY, marketId)) === 1;
    if (!exists) {
      return null;
    }

    const bidCount = await this.redis.zcard(
      `${this.ORDER_BOOK_PREFIX}${marketId}:bid`,
    );
    const askCount = await this.redis.zcard(
      `${this.ORDER_BOOK_PREFIX}${marketId}:ask`,
    );

    let totalBidQuantity = 0;
    let totalAskQuantity = 0;

    const bidIds = await this.redis.zrange(
      `${this.ORDER_BOOK_PREFIX}${marketId}:bid`,
      0,
      -1,
    );
    const askIds = await this.redis.zrange(
      `${this.ORDER_BOOK_PREFIX}${marketId}:ask`,
      0,
      -1,
    );

    for (const orderId of bidIds) {
      const orderData = await this.redis.get(`${this.ORDER_PREFIX}${orderId}`);
      if (orderData) {
        const order = JSON.parse(orderData);
        totalBidQuantity += order.quantity;
      }
    }

    for (const orderId of askIds) {
      const orderData = await this.redis.get(`${this.ORDER_PREFIX}${orderId}`);
      if (orderData) {
        const order = JSON.parse(orderData);
        totalAskQuantity += order.quantity;
      }
    }

    return {
      totalBids: bidCount,
      totalAsks: askCount,
      totalBidQuantity,
      totalAskQuantity,
    };
  }

  /**
   * Process matching results by updating Redis state
   */
  private async processMatchingResults(
    marketId: string,
    matchingResult: OrderMatchingResultDto,
  ): Promise<void> {
    // Remove completed orders from Redis
    for (const orderId of matchingResult.completedOrderIds) {
      await this.redis.del(`${this.ORDER_PREFIX}${orderId}`);

      // Remove from both bid and ask sorted sets (one will be a no-op)
      await this.redis.zrem(
        `${this.ORDER_BOOK_PREFIX}${marketId}:bid`,
        orderId,
      );
      await this.redis.zrem(
        `${this.ORDER_BOOK_PREFIX}${marketId}:ask`,
        orderId,
      );
    }

    // Update partially filled orders in Redis
    for (const update of matchingResult.updatedOrders) {
      const orderData = await this.redis.get(
        `${this.ORDER_PREFIX}${update.orderId}`,
      );
      if (orderData) {
        const order = JSON.parse(orderData);
        order.quantity = update.newQuantity;
        await this.redis.set(
          `${this.ORDER_PREFIX}${update.orderId}`,
          JSON.stringify(order),
        );
      }
    }

    // Add remaining order to Redis if it exists
    if (matchingResult.remainingOrder) {
      const remainingOrder = matchingResult.remainingOrder;
      const orderKey = `${this.ORDER_PREFIX}${remainingOrder.orderId}`;
      await this.redis.set(orderKey, JSON.stringify(remainingOrder));

      // Add to sorted set for price-based queries
      const score =
        remainingOrder.side === "bid"
          ? -remainingOrder.price
          : remainingOrder.price;
      await this.redis.zadd(
        `${this.ORDER_BOOK_PREFIX}${marketId}:${remainingOrder.side}`,
        score,
        remainingOrder.orderId,
      );

      // Ensure market is in the set of all markets
      await this.redis.sadd(this.MARKET_IDS_KEY, marketId);
    }
  }

  /**
   * Process matching results in Redis with retry and error handling
   */
  private async processMatchingResultsSafely(
    marketId: string,
    matchingResult: OrderMatchingResultDto,
    maxRetries: number = 3,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.processMatchingResults(marketId, matchingResult);
        return; // Success!
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Redis sync attempt ${attempt}/${maxRetries} failed for market ${marketId}:`,
          error,
        );

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 100),
          );
        }
      }
    }

    // All retries failed
    throw new Error(
      `Redis sync failed after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Attempt to recover Redis state by rebuilding from database
   */
  private async attemptRedisRecovery(
    marketId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _matchingResult: OrderMatchingResultDto, // kept for signature compatibility, but unused
  ): Promise<void> {
    try {
      this.logger.log(`Attempting Redis recovery for market ${marketId}...`);
      // Clear existing Redis data for this market
      await this.clearMarketFromRedis(marketId);

      // Rebuild order book from database
      await this.rebuildOrderBookFromDatabase(marketId);

      this.logger.log(`Redis recovery completed for market ${marketId}`);
    } catch (error) {
      this.logger.error(`Redis recovery failed for market ${marketId}:`, error);
      // Recovery failed - Redis will be inconsistent until manual intervention
      // or next restart when restoreOrderBookFromDatabase() runs
    }
  }

  /**
   * Clear all Redis data for a specific market
   */
  private async clearMarketFromRedis(marketId: string): Promise<void> {
    try {
      // Remove market from markets set
      await this.redis.srem(this.MARKET_IDS_KEY, marketId);

      // Clear bid and ask order books
      await this.redis.del(`${this.ORDER_BOOK_PREFIX}${marketId}:bid`);
      await this.redis.del(`${this.ORDER_BOOK_PREFIX}${marketId}:ask`);

      // Get all order keys for this market and delete them
      const orderKeys = await this.redis.keys(`${this.ORDER_PREFIX}*`);
      for (const orderKey of orderKeys) {
        const orderData = await this.redis.get(orderKey);
        if (orderData) {
          const order = JSON.parse(orderData);
          if (order.marketId === marketId) {
            await this.redis.del(orderKey);
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Error clearing Redis data for market ${marketId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Rebuild order book for a specific market from database
   */
  private async rebuildOrderBookFromDatabase(
    marketId: string,
  ): Promise<void> {
    try {
      // Get all active orders for this market from database
      const orders = await this.orderDao.getOrdersByMarket(marketId);

      if (orders.length === 0) {
        return; // No orders to rebuild
      }

      // Add market back to markets set
      await this.redis.sadd(this.MARKET_IDS_KEY, marketId);

      // Rebuild each order in Redis
      for (const orderRecord of orders) {
        const order: OrderBookEntryDto = {
          marketId: orderRecord.market_id,
          price: parseFloat(orderRecord.price),
          quantity: parseFloat(orderRecord.quantity),
          timestamp: orderRecord.created_at,
          orderId: orderRecord.id,
          side: orderRecord.side,
        };

        // Store order data
        const orderKey = `${this.ORDER_PREFIX}${order.orderId}`;
        await this.redis.set(orderKey, JSON.stringify(order));

        // Add to sorted set for price-based queries
        const score = order.side === "bid" ? -order.price : order.price;
        await this.redis.zadd(
          `${this.ORDER_BOOK_PREFIX}${marketId}:${order.side}`,
          score,
          order.orderId,
        );
      }

      this.logger.log(
        `Rebuilt ${orders.length} orders for market ${marketId} in Redis`,
      );
    } catch (error) {
      this.logger.error(
        `Error rebuilding order book for market ${marketId}:`,
        error,
      );
      throw error;
    }
  }
}
