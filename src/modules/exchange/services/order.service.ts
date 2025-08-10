import { Injectable, Logger, Inject, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import { REDIS_CLIENT } from "@/redis/constants/redis.constants";
import { OrderDao } from "../daos/order.dao";
import { TradeDao } from "../daos/trade.dao";
import { EventService } from "./event.service";
import { OrderBookEntryDto } from "../dtos/order/order-book-entry.dto";
import { OrderBookDto } from "../dtos/order/order-book.dto";
import { TradeExecutionDto } from "../dtos/trade/trade-execution.dto";
import { PortfolioDao } from "@/modules/portfolio/daos/portfolio.dao";
import { HoldingDao } from "@/modules/portfolio/daos/holding.dao";
import { BaseTransaction } from "@/database/base.transaction";
import { Knex } from "knex";
import { OrderMatchingResultDto } from "../dtos/order/order-matching-result.dto";
import { MatchResultDto } from "../dtos/order/match-result.dto";
import { OrderMatchingRequestDto } from "../dtos/order/order-matching-request.dto";
import { BatchUpdateOrderDto } from "../dtos/order/batch-update-order.dto";
import { BatchOrderOperationDto } from "../dtos/order/batch-order-operation.dto";
import { BatchCreateTradeDto } from "../dtos/trade/batch-create-trade.dto";
import { TradeType } from "../types/trade-type";

@Injectable()
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name);
  private readonly ORDER_BOOK_PREFIX = "orderbook:";
  private readonly ORDER_PREFIX = "order:";
  private readonly MARKET_IDS_KEY = "orderbook:markets";

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly orderDao: OrderDao,
    private readonly tradeDao: TradeDao,
    private readonly eventService: EventService,
    private readonly portfolioDao: PortfolioDao,
    private readonly holdingDao: HoldingDao,
  ) {}

  async onModuleInit() {
    await this.restoreOrderBookFromDatabase();
  }

  // ==================== ORDER BOOK MANAGEMENT ====================

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
        const orderData = {
          marketId: order.marketId,
          price: order.price,
          quantity: order.quantity,
          timestamp: order.createdAt.toISOString(),
          orderId: order.id,
          side: order.side,
          portfolioId: order.portfolioId,
        };

        await this.addOrderToRedisAtomically(
          marketId,
          order.id,
          orderData,
          order.side,
          order.price,
        );
      }

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

    this.logger.debug(`Created new order book for market: ${marketId}`);
    return orderBook;
  }

  /**
   * Get the complete order book for a market
   */
  async getOrderBook(marketId: string): Promise<OrderBookDto | null> {
    try {
      const hasOrderBook = await this.hasOrderBook(marketId);
      if (!hasOrderBook) {
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
    } catch (error) {
      this.logger.error(
        `Error getting order book for market ${marketId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get orders for a specific side of the order book
   */
  private async getOrdersBySide(
    marketId: string,
    side: "bid" | "ask",
  ): Promise<OrderBookEntryDto[]> {
    try {
      const orderIds = await this.redis.zrange(
        `${this.ORDER_BOOK_PREFIX}${marketId}:${side}`,
        0,
        -1,
      );

      if (orderIds.length === 0) {
        return [];
      }

      return await this.getOrdersByIds(orderIds);
    } catch (error) {
      this.logger.error(
        `Error getting orders by side for market ${marketId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Check if an order is from a paper portfolio
   */
  private async isOrderFromPaperPortfolio(
    portfolioId: string,
  ): Promise<boolean> {
    try {
      const portfolio = await this.portfolioDao.getPortfolioById(portfolioId);
      return portfolio?.type === "paper";
    } catch (error) {
      this.logger.error(
        `Error checking portfolio type for ${portfolioId}:`,
        error,
      );
      // Default to real portfolio if we can't determine the type
      return false;
    }
  }

  // ==================== ORDER MANAGEMENT ====================

  /**
   * Add an order with immediate matching against existing orders
   */
  async addOrderWithMatching(
    marketId: string,
    order: Omit<OrderBookEntryDto, "timestamp">,
  ): Promise<OrderMatchingResultDto> {
    // Check if this is a paper order by looking up the portfolio type
    const isPaperOrder = await this.isOrderFromPaperPortfolio(
      order.portfolioId,
    );
    if (isPaperOrder) {
      return await this.processPaperOrderMatching(marketId, order);
    }

    // Use database transaction to ensure atomicity for portfolio adjustments and order matching
    return await this.orderDao
      .transaction(async (trx) => {
        // Adjust portfolio balance and holdings before attempting to match the order
        const portfolioAdjusted = await this.adjustPortfolioForOrder(
          order,
          trx,
        );
        if (!portfolioAdjusted) {
          this.logger.error(
            `Failed to adjust portfolio for order in market: ${marketId}`,
          );
          throw new Error(
            `Failed to adjust portfolio for order in market: ${marketId}`,
          );
        }

        // Acquire market lock with shorter TTL for better throughput
        const lockAcquired = await this.acquireMarketLock(marketId, 5);
        if (!lockAcquired) {
          this.logger.error(
            `Failed to acquire market lock for order matching in market: ${marketId}`,
          );
          throw new Error(
            `Market ${marketId} is currently locked for order processing`,
          );
        }

        let matchingResult: OrderMatchingResultDto;
        try {
          // Attempt to match the order (this will use the same transaction)
          matchingResult = await this.processOrderMatchingWithTransaction(
            {
              marketId,
              incomingOrder: order,
            },
            trx,
          );
        } finally {
          // Always release the lock
          await this.releaseMarketLock(marketId);
        }

        // Process the matching results to update Redis
        await this.processMatchingResults(marketId, matchingResult);

        return matchingResult;
      })
      .catch((error) => {
        this.logger.error(
          `Error adding order with matching for market ${marketId}:`,
          error,
        );

        // Return safe fallback state
        return {
          matches: [],
          remainingOrder: {
            ...order,
            timestamp: new Date(),
          } as OrderBookEntryDto,
          updatedOrders: [],
          completedOrderIds: [],
        };
      });
  }

  /**
   * Process paper order matching - simulates matching without affecting order book or portfolios
   */
  private async processPaperOrderMatching(
    marketId: string,
    order: Omit<OrderBookEntryDto, "timestamp">,
  ): Promise<OrderMatchingResultDto> {
    try {
      // For paper orders, we still want to simulate matching but without:
      // 1. Adding to order book
      // 2. Affecting market state (prices/order book display)
      // Paper portfolios ARE adjusted to reflect the simulated trades

      this.logger.debug(
        `Processing paper order matching for market ${marketId}: ${order.side} ${order.quantity} @ ${order.price}`,
      );

      // Use database transaction for paper trade creation and portfolio adjustments
      return await this.orderDao.transaction(async (trx) => {
        // Adjust portfolio balance and holdings for paper order (same as real orders)
        const portfolioAdjusted = await this.adjustPortfolioForOrder(
          order,
          trx,
        );
        if (!portfolioAdjusted) {
          this.logger.error(
            `Failed to adjust portfolio for paper order in market: ${marketId}`,
          );
          throw new Error(
            `Failed to adjust portfolio for paper order in market: ${marketId}`,
          );
        }

        // Get current order book state for matching simulation (read-only)
        const opposingOrders = await this.getOpposingOrdersInTransaction(
          marketId,
          order.side,
          trx,
        );

        // Pre-calculate matches without modifying anything
        const { calculatedMatches } = this.calculateAllMatches(
          order,
          opposingOrders,
          order.quantity,
        );

        const matches: MatchResultDto[] = [];
        const pendingEvents: Array<{
          type: "orderMatch" | "orderFill" | "tradeExecution";
          data: any;
        }> = [];

        // Create paper trades for each match (but don't modify orders)
        if (calculatedMatches.length > 0) {
          await this.createPaperTrades(
            calculatedMatches,
            trx,
            matches,
            pendingEvents,
            marketId,
            order,
          );

          // Execute trade settlements for paper trades (transfer funds/holdings between portfolios)
          await this.settleTradesInTransaction(calculatedMatches, order, trx);
        }

        // For paper orders, always consume the entire quantity
        // Paper orders should always be fully "filled" for simulation purposes
        const remainingOrder: OrderBookEntryDto | null = null;

        const result = {
          matches,
          remainingOrder,
          updatedOrders: [], // No real orders are updated
          completedOrderIds: [], // No real orders are completed
        };

        // Publish events after successful transaction commit (paper trade events)
        setImmediate(async () => {
          await this.publishPendingEvents(pendingEvents);
        });

        this.logger.debug(
          `Paper order processed: ${matches.length} matches created, order fully filled`,
        );

        return result;
      });
    } catch (error) {
      this.logger.error(
        `Error processing paper order matching for market ${marketId}:`,
        error,
      );

      // Return safe fallback state - paper order is fully consumed
      // Note: Portfolio adjustments may have already occurred and been committed
      return {
        matches: [],
        remainingOrder: null, // Paper orders are always fully consumed
        updatedOrders: [],
        completedOrderIds: [],
      };
    }
  }

  /**
   * Add an order without matching (for manual order placement)
   */
  async addOrder(
    marketId: string,
    order: Omit<OrderBookEntryDto, "timestamp">,
  ): Promise<boolean> {
    // Use database transaction to ensure atomicity for portfolio adjustments and order creation
    return await this.orderDao
      .transaction(async (trx) => {
        // Adjust portfolio balance and holdings before creating the order
        const portfolioAdjusted = await this.adjustPortfolioForOrder(
          order,
          trx,
        );
        if (!portfolioAdjusted) {
          this.logger.error(
            `Failed to adjust portfolio for order in market: ${marketId}`,
          );
          throw new Error(
            `Failed to adjust portfolio for order in market: ${marketId}`,
          );
        }

        // Persist order to database using the transaction
        const orderDao = this.orderDao.transacting(trx);
        const dbOrderId = await orderDao.createOrder({
          ...order,
          marketId,
        });
        if (!dbOrderId) {
          this.logger.error(
            `Failed to persist order to database for market: ${marketId}`,
          );
          throw new Error(
            `Failed to persist order to database for market: ${marketId}`,
          );
        }

        // Update the order ID with the database-generated ID
        const orderWithId = { ...order, orderId: dbOrderId };

        // Add to Redis order book atomically using pipeline
        const orderData = {
          ...orderWithId,
          timestamp: new Date().toISOString(),
        };

        await this.addOrderToRedisAtomically(
          marketId,
          dbOrderId,
          orderData,
          order.side,
          order.price,
        );

        this.logger.debug(
          `Added order ${dbOrderId} to market ${marketId}: ${order.quantity} @ ${order.price} (${order.side})`,
        );

        return true;
      })
      .catch((error) => {
        this.logger.error(`Error adding order to market ${marketId}:`, error);
        return false;
      });
  }

  /**
   * Remove an order from the order book
   */
  async removeOrder(
    marketId: string,
    orderId: string,
    side: "bid" | "ask",
  ): Promise<boolean> {
    try {
      // Get order details before removal to restore portfolio
      const orderData = await this.redis.get(`${this.ORDER_PREFIX}${orderId}`);
      if (orderData) {
        const order = JSON.parse(orderData);
        // Restore portfolio balance/holdings for the cancelled order
        await this.restorePortfolioForCancelledOrder(order);
      }

      // Remove from database first
      const dbRemoved = await this.orderDao.deleteOrder(orderId);
      if (!dbRemoved) {
        this.logger.error(
          `Failed to delete order ${orderId} from database for market: ${marketId}`,
        );
        return false;
      }

      // Remove from Redis atomically
      await this.removeOrderFromRedisAtomically(marketId, orderId, side);

      this.logger.debug(
        `Removed order ${orderId} from market ${marketId} (${side})`,
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

  // ==================== ORDER MATCHING ====================

  /**
   * Process an incoming order and attempt to match it against existing orders
   * Uses price-time priority matching algorithm with atomic transaction safety
   */
  async processOrderMatching(
    request: OrderMatchingRequestDto,
  ): Promise<OrderMatchingResultDto> {
    return await this.processOrderMatchingWithTransaction(request);
  }

  /**
   * Acquire market-level lock for order matching
   */
  private async acquireMarketLock(
    marketId: string,
    ttlSeconds: number = 30,
  ): Promise<boolean> {
    try {
      const lockKey = `lock:market:${marketId}`;
      const lockValue = `${Date.now()}-${Math.random()}`;

      const result = await this.redis.set(
        lockKey,
        lockValue,
        "EX",
        ttlSeconds,
        "NX",
      );
      return result === "OK";
    } catch (error) {
      this.logger.error(`Error acquiring market lock for ${marketId}:`, error);
      return false;
    }
  }

  /**
   * Release market-level lock
   */
  private async releaseMarketLock(marketId: string): Promise<void> {
    try {
      const lockKey = `lock:market:${marketId}`;
      await this.redis.del(lockKey);
    } catch (error) {
      this.logger.error(`Error releasing market lock for ${marketId}:`, error);
    }
  }

  /**
   * Process an incoming order and attempt to match it against existing orders with an existing transaction
   * Uses price-time priority matching algorithm with atomic transaction safety
   */
  private async processOrderMatchingWithTransaction(
    request: OrderMatchingRequestDto,
    existingTrx?: BaseTransaction<Knex.Transaction<any, any[]>>,
  ): Promise<OrderMatchingResultDto> {
    const { marketId, incomingOrder } = request;

    // Use existing transaction if provided, otherwise create a new one
    const executeInTransaction = async (
      trx: BaseTransaction<Knex.Transaction<any, any[]>>,
    ) => {
      const matches: MatchResultDto[] = [];
      const updatedOrders: { orderId: string; newQuantity: number }[] = [];
      const completedOrderIds: string[] = [];
      const pendingEvents: Array<{
        type: "orderMatch" | "orderFill" | "tradeExecution";
        data: any;
      }> = [];

      let remainingIncomingQuantity = incomingOrder.quantity;
      let remainingOrder: OrderBookEntryDto | null = null;

      try {
        // Get opposing orders from database (sorted by price-time priority)
        const opposingOrders = await this.getOpposingOrdersInTransaction(
          marketId,
          incomingOrder.side,
          trx,
        );

        // Pre-calculate all matches before database operations for better performance
        const { calculatedMatches, finalRemainingQuantity } =
          this.calculateAllMatches(
            incomingOrder,
            opposingOrders,
            remainingIncomingQuantity,
          );

        // Batch all database operations for significant performance improvement
        if (calculatedMatches.length > 0) {
          await this.executeBatchedMatchOperations(
            calculatedMatches,
            trx,
            matches,
            updatedOrders,
            completedOrderIds,
            pendingEvents,
            marketId,
            incomingOrder,
          );

          // Execute trade settlements (transfer funds/holdings between portfolios)
          await this.settleTradesInTransaction(
            calculatedMatches,
            incomingOrder,
            trx,
          );
        }

        remainingIncomingQuantity = finalRemainingQuantity;

        // Handle remaining incoming order
        if (remainingIncomingQuantity > 0) {
          remainingOrder = {
            ...incomingOrder,
            quantity: remainingIncomingQuantity,
            timestamp: new Date(),
          } as OrderBookEntryDto;
        }

        // All database operations completed successfully within transaction
        // Transaction will auto-commit when this block exits
        const result = {
          matches,
          remainingOrder,
          updatedOrders,
          completedOrderIds,
        };

        // Publish events after successful transaction commit
        // This runs after the transaction commits
        setImmediate(async () => {
          await this.publishPendingEvents(pendingEvents);
        });

        return result;
      } catch (error) {
        this.logger.error(
          `Error processing order matching for market ${marketId}:`,
          error,
        );
        // Transaction will auto-rollback on error
        throw error;
      }
    };

    // Execute with existing transaction or create a new one
    if (existingTrx) {
      return await executeInTransaction(existingTrx);
    } else {
      return await this.orderDao
        .transaction(executeInTransaction)
        .catch((error) => {
          this.logger.error(
            `Transaction failed for order matching in market ${marketId}:`,
            error,
          );

          // Return safe fallback state - no matches, original order remains
          return {
            matches: [],
            remainingOrder: {
              ...incomingOrder,
              timestamp: new Date(),
            } as OrderBookEntryDto,
            updatedOrders: [],
            completedOrderIds: [],
          };
        });
    }
  }

  /**
   * Get opposing orders sorted by price-time priority (within transaction)
   */
  private async getOpposingOrdersInTransaction(
    marketId: string,
    incomingSide: "bid" | "ask",
    trx: BaseTransaction<Knex.Transaction<any, any[]>>,
  ): Promise<OrderBookEntryDto[]> {
    const opposingSide = incomingSide === "bid" ? "ask" : "bid";

    let orderDao: OrderDao = this.orderDao;

    if (trx) {
      orderDao = this.orderDao.transacting(trx);
    }

    const orders = await orderDao.getOrdersByMarketAndSideForMatching(
      marketId,
      opposingSide,
    );

    // Optimized mapping - avoid object spread for better performance
    const result = new Array(orders.length);
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      result[i] = {
        marketId: order.marketId,
        price: order.price,
        quantity: order.quantity,
        timestamp: order.createdAt,
        orderId: order.id,
        side: order.side,
        portfolioId: order.portfolioId,
      };
    }

    return result;
  }

  /**
   * Check if two orders can be matched based on price
   */
  private canOrdersMatch(
    incomingOrder: Omit<OrderBookEntryDto, "timestamp">,
    existingOrder: OrderBookEntryDto,
  ): boolean {
    if (incomingOrder.side === "bid") {
      // Incoming buy order can match if its price >= existing sell order price
      return incomingOrder.price >= existingOrder.price;
    } else {
      // Incoming sell order can match if its price <= existing buy order price
      return incomingOrder.price <= existingOrder.price;
    }
  }

  /**
   * Determine the price at which the match occurs
   * Uses the price of the existing order (maker's price takes priority)
   */
  private determineMatchPrice(
    incomingOrder: Omit<OrderBookEntryDto, "timestamp">,
    existingOrder: OrderBookEntryDto,
  ): number {
    // The existing order (maker) price takes priority
    return existingOrder.price;
  }

  /**
   * Store trade execution in database (within transaction) - DEPRECATED
   * Use batchInsertTrades for better performance
   */
  private async storeTradeInTransaction(
    match: MatchResultDto,
    trx: BaseTransaction<Knex.Transaction<any, any[]>>,
  ): Promise<TradeExecutionDto> {
    const trade: TradeExecutionDto = {
      tradeId: uuidv4(),
      marketId: match.marketId,
      takerOrderId: match.takerOrderId,
      makerOrderId: match.makerOrderId,
      takerSide: match.takerSide,
      type: "real", // TODO: Determine based on user/portfolio settings
      quantity: match.matchedQuantity,
      price: match.matchedPrice,
      timestamp: match.timestamp,
    };

    let tradeDao: TradeDao = this.tradeDao;

    if (trx) {
      tradeDao = this.tradeDao.transacting(trx);
    }

    await tradeDao.createTrade(trade);

    this.logger.debug(
      `Stored trade: ${trade.quantity} @ ${trade.price} for market ${trade.marketId} (taker: ${trade.takerSide})`,
    );

    return trade;
  }

  /**
   * Create paper trades without modifying orders or affecting portfolios
   */
  private async createPaperTrades(
    calculatedMatches: Array<{
      existingOrder: OrderBookEntryDto;
      matchedQuantity: number;
      matchedPrice: number;
      remainingExistingQuantity: number;
      isCompletelyFilled: boolean;
    }>,
    trx: BaseTransaction<Knex.Transaction<any, any[]>>,
    matches: MatchResultDto[],
    pendingEvents: Array<{ type: string; data: any }>,
    marketId: string,
    incomingOrder: Omit<OrderBookEntryDto, "timestamp">,
  ): Promise<void> {
    const tradeDao = this.tradeDao.transacting(trx);
    const batchTrades: BatchCreateTradeDto[] = [];

    for (const {
      existingOrder,
      matchedQuantity,
      matchedPrice,
    } of calculatedMatches) {
      const tradeId = uuidv4();

      // Create match result for paper trade (same as regular matching)
      const match: MatchResultDto = {
        marketId,
        takerOrderId: incomingOrder.orderId,
        makerOrderId: existingOrder.orderId,
        takerSide: incomingOrder.side,
        matchedQuantity,
        matchedPrice,
        timestamp: new Date(),
        takerRemainingQuantity: 0, // Paper orders are always fully consumed
        makerRemainingQuantity: existingOrder.quantity, // Existing orders are not affected
      };

      matches.push(match);

      // Add events for paper trades
      pendingEvents.push(
        {
          type: "orderMatch",
          data: {
            orderId: incomingOrder.orderId,
            marketId,
            side: incomingOrder.side,
            matchedQuantity,
            matchPrice: matchedPrice,
            remainingQuantity: 0, // Paper orders are always fully filled
          },
        },
        {
          type: "tradeExecution",
          data: {
            tradeId,
            marketId,
            takerOrderId: match.takerOrderId,
            makerOrderId: match.makerOrderId,
            takerSide: match.takerSide,
            quantity: match.matchedQuantity,
            price: match.matchedPrice,
            type: "paper", // Important: mark as paper trade
            timestamp: match.timestamp,
          },
        },
      );

      // Prepare paper trade using DTO - this is the key change from regular matching
      const tradeType: TradeType = "paper"; // Always paper for paper orders
      batchTrades.push(
        tradeDao.createBatchTradeDto(
          match.marketId,
          match.takerOrderId,
          match.makerOrderId,
          match.takerSide,
          tradeType,
          match.matchedQuantity,
          match.matchedPrice,
          match.timestamp,
        ),
      );
    }

    // Insert paper trades only (no order modifications)
    if (batchTrades.length > 0) {
      await tradeDao.batchCreateTrades(batchTrades);

      this.logger.debug(
        `Created ${batchTrades.length} paper trades for market ${marketId}`,
      );
    }
  }

  /**
   * Publish all pending events after transaction commit
   */
  private async publishPendingEvents(
    pendingEvents: Array<{
      type: "orderMatch" | "orderFill" | "tradeExecution";
      data: any;
    }>,
  ): Promise<void> {
    try {
      for (const event of pendingEvents) {
        switch (event.type) {
          case "orderMatch":
            await this.eventService.publishOrderMatch(event.data);
            break;
          case "orderFill":
            const {
              orderId,
              marketId,
              side,
              filledQuantity,
              remainingQuantity,
              fillPrice,
              isComplete,
            } = event.data;
            await this.eventService.publishOrderFill(
              orderId,
              marketId,
              side,
              filledQuantity,
              remainingQuantity,
              fillPrice,
              isComplete,
            );
            break;
          case "tradeExecution":
            await this.eventService.publishTradeExecution(event.data);
            break;
        }
      }
    } catch (error) {
      this.logger.error("Error publishing pending events:", error);
      // Events failed but data is already committed - log for manual recovery
    }
  }

  // ==================== TRADE SETTLEMENT ====================

  /**
   * Settle all trades by transferring funds and holdings between portfolios atomically
   */
  private async settleTradesInTransaction(
    calculatedMatches: Array<{
      existingOrder: OrderBookEntryDto;
      matchedQuantity: number;
      matchedPrice: number;
      remainingExistingQuantity: number;
      isCompletelyFilled: boolean;
    }>,
    incomingOrder: Omit<OrderBookEntryDto, "timestamp">,
    trx: BaseTransaction<Knex.Transaction<any, any[]>>,
  ): Promise<void> {
    const portfolioDao = this.portfolioDao.transacting(trx);
    const holdingDao = this.holdingDao.transacting(trx);

    for (const match of calculatedMatches) {
      const { existingOrder, matchedQuantity, matchedPrice } = match;
      const tradeValue = matchedQuantity * matchedPrice;

      try {
        if (incomingOrder.side === "bid") {
          // Incoming order is buying, existing order is selling
          await this.settleBuyTrade(
            incomingOrder.portfolioId, // Buyer
            existingOrder.portfolioId, // Seller
            existingOrder.marketId,
            matchedQuantity,
            tradeValue,
            portfolioDao,
            holdingDao,
          );
        } else {
          // Incoming order is selling, existing order is buying
          await this.settleSellTrade(
            existingOrder.portfolioId, // Buyer
            incomingOrder.portfolioId, // Seller
            incomingOrder.marketId,
            matchedQuantity,
            tradeValue,
            portfolioDao,
            holdingDao,
          );
        }

        this.logger.debug(
          `Settled trade: ${matchedQuantity} @ ${matchedPrice} between portfolios ${incomingOrder.portfolioId} and ${existingOrder.portfolioId}`,
        );
      } catch (error) {
        this.logger.error("Error settling trade:", error);
        throw error; // Will rollback the entire transaction
      }
    }
  }

  /**
   * Settle a buy trade: transfer holdings from seller to buyer, money from buyer to seller
   */
  private async settleBuyTrade(
    buyerPortfolioId: string,
    sellerPortfolioId: string,
    marketId: string,
    quantity: number,
    tradeValue: number,
    portfolioDao: any,
    holdingDao: any,
  ): Promise<void> {
    // 1. Transfer money: buyer pays seller
    const buyerBalanceAdjusted = await portfolioDao.adjustBalanceByPortfolioId(
      buyerPortfolioId,
      -tradeValue, // Deduct from buyer
    );

    if (!buyerBalanceAdjusted) {
      throw new Error(
        `Failed to deduct ${tradeValue} from buyer portfolio ${buyerPortfolioId}`,
      );
    }

    const sellerBalanceAdjusted = await portfolioDao.adjustBalanceByPortfolioId(
      sellerPortfolioId,
      tradeValue, // Add to seller
    );

    if (!sellerBalanceAdjusted) {
      throw new Error(
        `Failed to add ${tradeValue} to seller portfolio ${sellerPortfolioId}`,
      );
    }

    // 2. Transfer holdings: seller gives holdings to buyer
    const sellerHoldingAdjusted = await holdingDao.adjustHoldingQuantity(
      sellerPortfolioId,
      marketId,
      -quantity, // Deduct from seller
    );

    if (!sellerHoldingAdjusted) {
      throw new Error(
        `Failed to deduct ${quantity} holdings from seller portfolio ${sellerPortfolioId}`,
      );
    }

    const buyerHoldingAdjusted = await holdingDao.adjustHoldingQuantity(
      buyerPortfolioId,
      marketId,
      quantity, // Add to buyer
    );

    if (!buyerHoldingAdjusted) {
      throw new Error(
        `Failed to add ${quantity} holdings to buyer portfolio ${buyerPortfolioId}`,
      );
    }
  }

  /**
   * Settle a sell trade: transfer holdings from seller to buyer, money from buyer to seller
   */
  private async settleSellTrade(
    buyerPortfolioId: string,
    sellerPortfolioId: string,
    marketId: string,
    quantity: number,
    tradeValue: number,
    portfolioDao: any,
    holdingDao: any,
  ): Promise<void> {
    // Same logic as settleBuyTrade since the parameters are already correctly ordered
    await this.settleBuyTrade(
      buyerPortfolioId,
      sellerPortfolioId,
      marketId,
      quantity,
      tradeValue,
      portfolioDao,
      holdingDao,
    );
  }

  // ==================== PORTFOLIO MANAGEMENT ====================

  /**
   * Adjust portfolio balance and holdings for a new order
   * For bid orders: reserve balance for the order
   * For ask orders: reserve holdings quantity for the order
   */
  private async adjustPortfolioForOrder(
    order: Omit<OrderBookEntryDto, "timestamp">,
    trx?: BaseTransaction<Knex.Transaction<any, any[]>>,
  ): Promise<boolean> {
    let portfolioDao = this.portfolioDao;
    let holdingDao = this.holdingDao;

    if (trx) {
      portfolioDao = this.portfolioDao.transacting(trx);
      holdingDao = this.holdingDao.transacting(trx);
    }

    try {
      if (order.side === "bid") {
        // For bid orders, atomically check and reserve balance
        const totalCost = order.price * order.quantity;

        const balanceReserved = await portfolioDao.reserveBalance(
          order.portfolioId,
          totalCost,
        );

        if (!balanceReserved) {
          this.logger.error(
            `Insufficient balance for bid order by portfolio ${order.portfolioId}. Required: ${totalCost}`,
          );
          return false;
        }

        this.logger.debug(
          `Reserved ${totalCost} balance for bid order by portfolio: ${order.portfolioId}`,
        );
      } else if (order.side === "ask") {
        // For ask orders, atomically check and reserve holdings quantity
        const holdingReserved = await holdingDao.reserveHolding(
          order.portfolioId,
          order.marketId,
          order.quantity,
        );

        if (!holdingReserved) {
          this.logger.error(
            `Insufficient holdings for ask order by portfolio ${order.portfolioId} in market ${order.marketId}. Required: ${order.quantity}`,
          );
          return false;
        }

        this.logger.debug(
          `Reserved ${order.quantity} holdings for ask order by portfolio: ${order.portfolioId} in market: ${order.marketId}`,
        );
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Error adjusting portfolio for order by portfolio ${order.portfolioId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Restore portfolio balance and holdings for a cancelled order
   * For bid orders: restore the reserved balance
   * For ask orders: restore the reserved holdings quantity
   */
  private async restorePortfolioForCancelledOrder(
    order: OrderBookEntryDto,
    trx?: BaseTransaction<Knex.Transaction<any, any[]>>,
  ): Promise<void> {
    try {
      let portfolioDao = this.portfolioDao;
      let holdingDao = this.holdingDao;

      if (trx) {
        portfolioDao = this.portfolioDao.transacting(trx);
        holdingDao = this.holdingDao.transacting(trx);
      }

      if (order.side === "bid") {
        // For bid orders, restore the reserved balance
        const totalCost = order.price * order.quantity;
        const balanceRestored = await portfolioDao.adjustBalanceByPortfolioId(
          order.portfolioId,
          totalCost,
        );

        if (balanceRestored) {
          this.logger.debug(
            `Restored ${totalCost} balance for cancelled bid order by portfolio: ${order.portfolioId}`,
          );
        } else {
          this.logger.error(
            `Failed to restore balance for cancelled bid order by portfolio: ${order.portfolioId}`,
          );
        }
      } else if (order.side === "ask") {
        // For ask orders, restore the reserved holdings quantity
        const holdingsRestored = await holdingDao.adjustHoldingQuantity(
          order.portfolioId,
          order.marketId,
          order.quantity,
        );

        if (holdingsRestored) {
          this.logger.debug(
            `Restored ${order.quantity} holdings for cancelled ask order by portfolio: ${order.portfolioId} in market: ${order.marketId}`,
          );
        } else {
          this.logger.error(
            `Failed to restore holdings for cancelled ask order by portfolio: ${order.portfolioId} in market: ${order.marketId}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error restoring portfolio for cancelled order by portfolio ${order.portfolioId}:`,
        error,
      );
    }
  }

  // ==================== MATCHING RESULTS PROCESSING ====================

  /**
   * Process matching results to update Redis order book with batched operations
   */
  private async processMatchingResults(
    marketId: string,
    matchingResult: OrderMatchingResultDto,
  ): Promise<void> {
    try {
      // Use pipeline for all Redis operations to improve performance
      const pipeline = this.redis.pipeline();

      // Batch update order quantities
      for (const updatedOrder of matchingResult.updatedOrders) {
        const orderKey = `${this.ORDER_PREFIX}${updatedOrder.orderId}`;
        pipeline.get(orderKey);
      }

      // Get all order data first
      const results = await pipeline.exec();

      if (results) {
        // Create new pipeline for updates
        const updatePipeline = this.redis.pipeline();

        // Process updates
        for (let i = 0; i < matchingResult.updatedOrders.length; i++) {
          const updatedOrder = matchingResult.updatedOrders[i];
          const [error, orderData] = results[i];

          if (!error && orderData) {
            const order = JSON.parse(orderData as string);
            order.quantity = updatedOrder.newQuantity;
            const orderKey = `${this.ORDER_PREFIX}${updatedOrder.orderId}`;
            updatePipeline.set(orderKey, JSON.stringify(order));
          }
        }

        // Batch remove completed orders
        for (const completedOrderId of matchingResult.completedOrderIds) {
          const orderKey = `${this.ORDER_PREFIX}${completedOrderId}`;
          updatePipeline.get(orderKey); // Get order data to determine side
        }

        // Execute updates and gets
        const updateResults = await updatePipeline.exec();

        if (updateResults) {
          // Create final pipeline for removals
          const removalPipeline = this.redis.pipeline();

          // Process removals (get side from fetched data)
          const startIndex = matchingResult.updatedOrders.length;
          for (let i = 0; i < matchingResult.completedOrderIds.length; i++) {
            const completedOrderId = matchingResult.completedOrderIds[i];
            const resultIndex = startIndex + i;
            const [error, orderData] = updateResults[resultIndex];

            if (!error && orderData) {
              const order = JSON.parse(orderData as string);
              const orderKey = `${this.ORDER_PREFIX}${completedOrderId}`;

              removalPipeline.del(orderKey);
              removalPipeline.zrem(
                `${this.ORDER_BOOK_PREFIX}${marketId}:${order.side}`,
                completedOrderId,
              );
            }
          }

          await removalPipeline.exec();
        }
      }

      // Add remaining order if it exists (this is rare, so individual operation is ok)
      if (matchingResult.remainingOrder) {
        await this.addOrder(marketId, matchingResult.remainingOrder);
      }

      this.logger.debug(
        `Processed matching results for market ${marketId}: ${matchingResult.matches.length} matches, ${matchingResult.completedOrderIds.length} completed orders`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing matching results for market ${marketId}:`,
        error,
      );
      // Attempt recovery
      await this.processMatchingResultsSafely(marketId, matchingResult);
    }
  }

  /**
   * Safely process matching results with retry logic
   */
  private async processMatchingResultsSafely(
    marketId: string,
    matchingResult: OrderMatchingResultDto,
    maxRetries: number = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.warn(
          `Retry ${attempt}/${maxRetries} processing matching results for market ${marketId}`,
        );

        await this.processMatchingResults(marketId, matchingResult);
        return; // Success
      } catch (error) {
        this.logger.error(
          `Retry ${attempt}/${maxRetries} failed for market ${marketId}:`,
          error,
        );

        if (attempt === maxRetries) {
          this.logger.error(
            `All retries failed for market ${marketId}, attempting Redis recovery`,
          );
          await this.attemptRedisRecovery(marketId, matchingResult);
        } else {
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }

  /**
   * Attempt to recover Redis state from database
   */
  private async attemptRedisRecovery(
    marketId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    matchingResult: OrderMatchingResultDto,
  ): Promise<void> {
    try {
      this.logger.warn(`Attempting Redis recovery for market ${marketId}`);

      // Clear current Redis state for this market
      await this.clearMarketFromRedis(marketId);

      // Rebuild from database
      await this.rebuildOrderBookFromDatabase(marketId);

      this.logger.log(`Redis recovery completed for market ${marketId}`);
    } catch (error) {
      this.logger.error(`Redis recovery failed for market ${marketId}:`, error);
      // At this point, manual intervention may be required
    }
  }

  /**
   * Clear all Redis data for a specific market
   */
  private async clearMarketFromRedis(marketId: string): Promise<void> {
    try {
      // Use pipeline for all operations - much faster
      const pipeline = this.redis.pipeline();

      // Get all order IDs for this market (parallel)
      const [bidOrderIds, askOrderIds] = await Promise.all([
        this.redis.zrange(`${this.ORDER_BOOK_PREFIX}${marketId}:bid`, 0, -1),
        this.redis.zrange(`${this.ORDER_BOOK_PREFIX}${marketId}:ask`, 0, -1),
      ]);

      // Queue all deletions in pipeline
      const allOrderIds = [...bidOrderIds, ...askOrderIds];
      if (allOrderIds.length > 0) {
        allOrderIds.forEach((id) => {
          pipeline.del(`${this.ORDER_PREFIX}${id}`);
        });
      }

      // Queue sorted set and market set deletions
      pipeline.del(`${this.ORDER_BOOK_PREFIX}${marketId}:bid`);
      pipeline.del(`${this.ORDER_BOOK_PREFIX}${marketId}:ask`);
      pipeline.srem(this.MARKET_IDS_KEY, marketId);

      // Execute all operations atomically
      await pipeline.exec();

      this.logger.debug(`Cleared Redis data for market ${marketId}`);
    } catch (error) {
      this.logger.error(
        `Error clearing Redis data for market ${marketId}:`,
        error,
      );
    }
  }

  /**
   * Rebuild order book for a specific market from database
   */
  private async rebuildOrderBookFromDatabase(marketId: string): Promise<void> {
    try {
      const orders = await this.orderDao.getOrdersByMarket(marketId);

      // Store orders in Redis
      for (const orderRecord of orders) {
        const order: OrderBookEntryDto = {
          marketId: orderRecord.marketId,
          price: orderRecord.price,
          quantity: orderRecord.quantity,
          timestamp: orderRecord.createdAt,
          orderId: orderRecord.id,
          side: orderRecord.side,
          portfolioId: orderRecord.portfolioId,
        };

        await this.addOrderToRedisAtomically(
          marketId,
          order.orderId,
          order,
          order.side,
          order.price,
        );
      }

      // Ensure market is tracked
      await this.redis.sadd(this.MARKET_IDS_KEY, marketId);

      this.logger.debug(
        `Rebuilt order book for market ${marketId}: ${orders.length} orders`,
      );
    } catch (error) {
      this.logger.error(
        `Error rebuilding order book for market ${marketId}:`,
        error,
      );
    }
  }

  // ==================== ORDER BOOK QUERIES ====================

  /**
   * Get the best bid for a market
   */
  async getBestBid(marketId: string): Promise<OrderBookEntryDto | null> {
    try {
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
    } catch (error) {
      this.logger.error(
        `Error getting best bid for market ${marketId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get the best ask for a market
   */
  async getBestAsk(marketId: string): Promise<OrderBookEntryDto | null> {
    try {
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
    } catch (error) {
      this.logger.error(
        `Error getting best ask for market ${marketId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Get the spread between best bid and best ask
   */
  async getSpread(marketId: string): Promise<number | null> {
    try {
      // Parallel fetching for better performance
      const [bestBid, bestAsk] = await Promise.all([
        this.getBestBid(marketId),
        this.getBestAsk(marketId),
      ]);

      if (!bestBid || !bestAsk) {
        return null;
      }

      return bestAsk.price - bestBid.price;
    } catch (error) {
      this.logger.error(`Error getting spread for market ${marketId}:`, error);
      return null;
    }
  }

  /**
   * Get order book depth for a market
   */
  async getDepth(
    marketId: string,
    levels: number = 10,
  ): Promise<{ bids: OrderBookEntryDto[]; asks: OrderBookEntryDto[] } | null> {
    try {
      // Parallel Redis queries for better performance
      const [bids, asks] = await Promise.all([
        this.redis.zrange(
          `${this.ORDER_BOOK_PREFIX}${marketId}:bid`,
          0,
          levels - 1,
        ),
        this.redis.zrange(
          `${this.ORDER_BOOK_PREFIX}${marketId}:ask`,
          0,
          levels - 1,
        ),
      ]);

      // Parallel order data fetching
      const [bidOrders, askOrders] = await Promise.all([
        this.getOrdersByIds(bids),
        this.getOrdersByIds(asks),
      ]);

      return {
        bids: bidOrders,
        asks: askOrders,
      };
    } catch (error) {
      this.logger.error(`Error getting depth for market ${marketId}:`, error);
      return null;
    }
  }

  /**
   * Get orders by their IDs
   */
  private async getOrdersByIds(
    orderIds: string[],
  ): Promise<OrderBookEntryDto[]> {
    if (orderIds.length === 0) {
      return [];
    }

    try {
      // Use pipeline for better performance with many orders
      if (orderIds.length > 10) {
        const pipeline = this.redis.pipeline();
        orderIds.forEach((id) => {
          pipeline.get(`${this.ORDER_PREFIX}${id}`);
        });

        const results = await pipeline.exec();

        if (!results) return [];

        const orders: OrderBookEntryDto[] = [];
        for (const [error, data] of results) {
          if (!error && data) {
            orders.push(JSON.parse(data as string));
          }
        }
        return orders;
      } else {
        // For small batches, use Promise.all (less overhead)
        const orderDataPromises = orderIds.map((id) =>
          this.redis.get(`${this.ORDER_PREFIX}${id}`),
        );
        const orderDataResults = await Promise.all(orderDataPromises);

        return orderDataResults
          .filter((data) => data !== null)
          .map((data) => JSON.parse(data!));
      }
    } catch (error) {
      this.logger.error("Error getting orders by IDs:", error);
      return [];
    }
  }

  /**
   * Get total quantity at a specific price level
   */
  async getQuantityAtPrice(
    marketId: string,
    price: number,
    side: "bid" | "ask",
  ): Promise<number> {
    try {
      const orderIds = await this.redis.zrange(
        `${this.ORDER_BOOK_PREFIX}${marketId}:${side}`,
        0,
        -1,
      );

      if (orderIds.length === 0) {
        return 0;
      }

      const orders = await this.getOrdersByIds(orderIds);
      const ordersAtPrice = orders.filter((order) => order.price === price);

      return ordersAtPrice.reduce((total, order) => total + order.quantity, 0);
    } catch (error) {
      this.logger.error(
        `Error getting quantity at price ${price} for market ${marketId}:`,
        error,
      );
      return 0;
    }
  }

  // ==================== ORDER BOOK MAINTENANCE ====================

  /**
   * Clear the entire order book for a market
   */
  async clearOrderBook(marketId: string): Promise<boolean> {
    try {
      // Remove from database
      await this.orderDao.deleteOrdersByMarket(marketId);

      // Clear Redis
      await this.clearMarketFromRedis(marketId);

      this.logger.debug(`Cleared order book for market ${marketId}`);
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
    try {
      return await this.redis.smembers(this.MARKET_IDS_KEY);
    } catch (error) {
      this.logger.error("Error getting market IDs:", error);
      return [];
    }
  }

  /**
   * Check if a market has an order book
   */
  async hasOrderBook(marketId: string): Promise<boolean> {
    try {
      const result = await this.redis.sismember(this.MARKET_IDS_KEY, marketId);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Error checking if market ${marketId} has order book:`,
        error,
      );
      return false;
    }
  }

  /**
   * Refresh order book for a market from database
   */
  async refreshOrderBook(marketId: string): Promise<boolean> {
    try {
      // Clear current Redis state
      await this.clearMarketFromRedis(marketId);

      // Rebuild from database
      await this.rebuildOrderBookFromDatabase(marketId);

      this.logger.debug(`Refreshed order book for market ${marketId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error refreshing order book for market ${marketId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get order book statistics for a market
   */
  async getOrderBookStats(marketId: string): Promise<{
    totalBids: number;
    totalAsks: number;
    totalBidQuantity: number;
    totalAskQuantity: number;
  } | null> {
    try {
      const bids = await this.getOrdersBySide(marketId, "bid");
      const asks = await this.getOrdersBySide(marketId, "ask");

      const totalBidQuantity = bids.reduce(
        (sum, order) => sum + order.quantity,
        0,
      );
      const totalAskQuantity = asks.reduce(
        (sum, order) => sum + order.quantity,
        0,
      );

      return {
        totalBids: bids.length,
        totalAsks: asks.length,
        totalBidQuantity,
        totalAskQuantity,
      };
    } catch (error) {
      this.logger.error(
        `Error getting order book stats for market ${marketId}:`,
        error,
      );
      return null;
    }
  }

  // ==================== TRADE QUERIES ====================

  /**
   * Get recent trades for a market
   */
  async getRecentTrades(
    marketId: string,
    limit: number = 50,
  ): Promise<TradeExecutionDto[]> {
    try {
      const trades = await this.tradeDao.getRecentTrades(marketId, limit);

      return trades.map((trade) => ({
        tradeId: trade.tradeId,
        marketId: trade.marketId,
        takerOrderId: trade.takerOrderId,
        makerOrderId: trade.makerOrderId,
        takerSide: trade.takerSide,
        type: trade.type,
        quantity: trade.quantity,
        price: trade.price,
        timestamp: trade.createdAt,
        takerUserId: trade.takerUserId,
        makerUserId: trade.makerUserId,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting recent trades for market ${marketId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get the last trade price for a market
   */
  async getLastTradePrice(marketId: string): Promise<number | null> {
    try {
      return await this.tradeDao.getLastTradePrice(marketId);
    } catch (error) {
      this.logger.error(
        `Error getting last trade price for market ${marketId}:`,
        error,
      );
      return null;
    }
  }

  // ==================== OPTIMIZED MATCHING METHODS ====================

  /**
   * Pre-calculate all matches without database operations for better performance
   */
  private calculateAllMatches(
    incomingOrder: Omit<OrderBookEntryDto, "timestamp">,
    opposingOrders: OrderBookEntryDto[],
    initialRemainingQuantity: number,
  ): {
    calculatedMatches: Array<{
      existingOrder: OrderBookEntryDto;
      matchedQuantity: number;
      matchedPrice: number;
      remainingExistingQuantity: number;
      isCompletelyFilled: boolean;
    }>;
    finalRemainingQuantity: number;
  } {
    const calculatedMatches = [];
    let remainingQuantity = initialRemainingQuantity;

    for (const existingOrder of opposingOrders) {
      if (remainingQuantity <= 0) {
        break;
      }

      // Check if orders can be matched based on price
      if (!this.canOrdersMatch(incomingOrder, existingOrder)) {
        break; // Since orders are sorted by price, no further matches possible
      }

      // Calculate match details
      const matchedQuantity = Math.min(
        remainingQuantity,
        existingOrder.quantity,
      );
      const matchedPrice = this.determineMatchPrice(
        incomingOrder,
        existingOrder,
      );
      const remainingExistingQuantity =
        existingOrder.quantity - matchedQuantity;

      calculatedMatches.push({
        existingOrder,
        matchedQuantity,
        matchedPrice,
        remainingExistingQuantity,
        isCompletelyFilled: remainingExistingQuantity === 0,
      });

      remainingQuantity -= matchedQuantity;
    }

    return {
      calculatedMatches,
      finalRemainingQuantity: remainingQuantity,
    };
  }

  /**
   * Execute all database operations in optimized batches using DAO methods
   */
  private async executeBatchedMatchOperations(
    calculatedMatches: Array<{
      existingOrder: OrderBookEntryDto;
      matchedQuantity: number;
      matchedPrice: number;
      remainingExistingQuantity: number;
      isCompletelyFilled: boolean;
    }>,
    trx: BaseTransaction<Knex.Transaction<any, any[]>>,
    matches: MatchResultDto[],
    updatedOrders: { orderId: string; newQuantity: number }[],
    completedOrderIds: string[],
    pendingEvents: Array<{ type: string; data: any }>,
    marketId: string,
    incomingOrder: Omit<OrderBookEntryDto, "timestamp">,
  ): Promise<void> {
    const orderDao = this.orderDao.transacting(trx);
    const tradeDao = this.tradeDao.transacting(trx);

    // Prepare batch operations using DTOs
    const batchOrderUpdates: BatchUpdateOrderDto[] = [];
    const batchOrderDeletes: string[] = [];
    const batchTrades: BatchCreateTradeDto[] = [];

    let currentRemainingQuantity = incomingOrder.quantity;

    // Process all matches and prepare batch operations
    for (const calculatedMatch of calculatedMatches) {
      const {
        existingOrder,
        matchedQuantity,
        matchedPrice,
        remainingExistingQuantity,
        isCompletelyFilled,
      } = calculatedMatch;

      currentRemainingQuantity -= matchedQuantity;

      // Create match result
      const match: MatchResultDto = {
        marketId,
        takerOrderId: incomingOrder.orderId,
        makerOrderId: existingOrder.orderId,
        takerSide: incomingOrder.side,
        matchedQuantity,
        matchedPrice,
        timestamp: new Date(),
        takerRemainingQuantity: currentRemainingQuantity,
        makerRemainingQuantity: remainingExistingQuantity,
      };

      matches.push(match);

      // Queue events
      pendingEvents.push(
        { type: "orderMatch", data: match },
        {
          type: "orderFill",
          data: {
            orderId: existingOrder.orderId,
            marketId,
            side: existingOrder.side,
            filledQuantity: matchedQuantity,
            remainingQuantity: remainingExistingQuantity,
            fillPrice: matchedPrice,
            isComplete: isCompletelyFilled,
          },
        },
        {
          type: "orderFill",
          data: {
            orderId: incomingOrder.orderId,
            marketId,
            side: incomingOrder.side,
            filledQuantity: matchedQuantity,
            remainingQuantity: currentRemainingQuantity,
            fillPrice: matchedPrice,
            isComplete: currentRemainingQuantity === 0,
          },
        },
      );

      // Prepare database operations using DTOs
      if (isCompletelyFilled) {
        batchOrderDeletes.push(existingOrder.orderId);
        completedOrderIds.push(existingOrder.orderId);
      } else {
        batchOrderUpdates.push({
          orderId: existingOrder.orderId,
          newQuantity: remainingExistingQuantity,
        });
        updatedOrders.push({
          orderId: existingOrder.orderId,
          newQuantity: remainingExistingQuantity,
        });
      }

      // Prepare trade using DTO
      // Determine trade type based on the incoming order's portfolio type
      const isPaperTrade = await this.isOrderFromPaperPortfolio(
        incomingOrder.portfolioId,
      );
      const tradeType: TradeType = isPaperTrade ? "paper" : "real";
      batchTrades.push(
        tradeDao.createBatchTradeDto(
          match.marketId,
          match.takerOrderId,
          match.makerOrderId,
          match.takerSide,
          tradeType,
          match.matchedQuantity,
          match.matchedPrice,
          match.timestamp,
        ),
      );
    }

    // Execute all database operations using DAO batch methods
    const batchOperations: BatchOrderOperationDto = {
      updates: batchOrderUpdates,
      deletes: batchOrderDeletes,
    };

    await Promise.all([
      // Batch order operations (updates and deletes)
      batchOperations.updates.length > 0 || batchOperations.deletes.length > 0
        ? orderDao.executeBatchOrderOperations(batchOperations)
        : Promise.resolve({
            updateResult: { successCount: 0, failedOrderIds: [] },
            deleteResult: { deletedCount: 0, failedOrderIds: [] },
          }),
      // Batch insert trades
      batchTrades.length > 0
        ? tradeDao.batchCreateTrades(batchTrades)
        : Promise.resolve({ tradesCreated: 0, createdTradeIds: [] }),
    ]);
  }

  // Deprecated batch methods - now using DAO methods with proper DTOs
  // These methods are kept temporarily for reference but should not be used

  // ==================== HELPER METHODS ====================

  /**
   * Add order to Redis atomically using pipeline
   */
  private async addOrderToRedisAtomically(
    marketId: string,
    orderId: string,
    orderData: any,
    side: "bid" | "ask",
    price: number,
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      const orderKey = `${this.ORDER_PREFIX}${orderId}`;
      const score = side === "bid" ? -price : price;

      // All operations are queued and executed atomically
      pipeline.set(orderKey, JSON.stringify(orderData));
      pipeline.zadd(
        `${this.ORDER_BOOK_PREFIX}${marketId}:${side}`,
        score,
        orderId,
      );
      pipeline.sadd(this.MARKET_IDS_KEY, marketId);

      const results = await pipeline.exec();

      // Check if all operations succeeded
      if (results) {
        for (const [error] of results) {
          if (error) {
            throw error;
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Error adding order ${orderId} to Redis atomically:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Remove order from Redis atomically using pipeline
   */
  private async removeOrderFromRedisAtomically(
    marketId: string,
    orderId: string,
    side: "bid" | "ask",
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      const orderKey = `${this.ORDER_PREFIX}${orderId}`;

      // All operations are queued and executed atomically
      pipeline.del(orderKey);
      pipeline.zrem(`${this.ORDER_BOOK_PREFIX}${marketId}:${side}`, orderId);

      const results = await pipeline.exec();

      // Check if all operations succeeded
      if (results) {
        for (const [error] of results) {
          if (error) {
            throw error;
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Error removing order ${orderId} from Redis atomically:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update order quantity in Redis
   */
  private async updateOrderInRedis(
    marketId: string,
    orderId: string,
    newQuantity: number,
  ): Promise<void> {
    try {
      const orderData = await this.redis.get(`${this.ORDER_PREFIX}${orderId}`);
      if (orderData) {
        const order = JSON.parse(orderData);
        order.quantity = newQuantity;
        await this.redis.set(
          `${this.ORDER_PREFIX}${orderId}`,
          JSON.stringify(order),
        );
      }
    } catch (error) {
      this.logger.error(`Error updating order ${orderId} in Redis:`, error);
    }
  }

  /**
   * Remove order from Redis
   */
  private async removeOrderFromRedis(
    marketId: string,
    orderId: string,
  ): Promise<void> {
    try {
      // Get order data to determine side
      const orderData = await this.redis.get(`${this.ORDER_PREFIX}${orderId}`);
      if (orderData) {
        const order = JSON.parse(orderData);

        // Remove from Redis atomically
        await this.removeOrderFromRedisAtomically(
          marketId,
          orderId,
          order.side,
        );
      }
    } catch (error) {
      this.logger.error(`Error removing order ${orderId} from Redis:`, error);
    }
  }
}
