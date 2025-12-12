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
import { BaseTransaction } from "@/database/base-transaction";
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

      // Store orders in Redis using aggregated structure
      for (const order of orders) {
        await this.addOrderToRedisAtomically(
          marketId,
          order.id,
          order,
          order.side,
          order.price,
          order.quantity,
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

  // ==================== ORDER MATCHING ====================

  /**
   * Add an order with matching logic
   */
  async addOrderWithMatching(
    marketId: string,
    order: Omit<OrderBookEntryDto, "timestamp">,
  ): Promise<OrderMatchingResultDto> {
    return await this.processOrderMatching(marketId, order);
  }

  /**
   * Process order matching
   */
  private async processOrderMatching(
    marketId: string,
    order: Omit<OrderBookEntryDto, "timestamp">,
  ): Promise<OrderMatchingResultDto> {
    try {
      // Validate portfolio ID format before processing
      if (!this.isValidUuid(order.portfolioId)) {
        throw new Error(`Invalid portfolio ID format: ${order.portfolioId}`);
      }

      // First, save the incoming order to the database so it has a valid ID for trades
      const orderWithTimestamp = {
        ...order,
        timestamp: new Date(),
      };
      
      const savedTakerOrderId = await this.orderDao.createOrder(orderWithTimestamp);
      if (!savedTakerOrderId) {
        throw new Error("Failed to save taker order to database");
      }

      // Update the order object with the saved ID
      const takerOrder = {
        ...orderWithTimestamp,
        orderId: savedTakerOrderId,
      };

      // Get opposing orders for matching from database (not aggregated Redis data)
      const opposingSide = order.side === "bid" ? "ask" : "bid";
      const opposingOrdersFromDb = await this.orderDao.getOrdersByMarketAndSideForMatching(marketId, opposingSide);
      
      // Convert database orders to OrderBookEntryDto format
      const opposingOrders: OrderBookEntryDto[] = opposingOrdersFromDb.map(dbOrder => ({
        marketId: dbOrder.marketId,
        price: dbOrder.price,
        quantity: dbOrder.quantity,
        side: dbOrder.side,
        timestamp: dbOrder.createdAt,
        orderId: dbOrder.id,
        portfolioId: dbOrder.portfolioId,
      }));

      // Calculate matches
      const calculatedMatches = this.calculateMatches(takerOrder, opposingOrders);
      const matches: MatchResultDto[] = [];

      if (calculatedMatches.length > 0) {
        await this.createTrades(calculatedMatches, matches, marketId, takerOrder);
      }

      // Handle remaining order quantity
      let remainingOrder: OrderBookEntryDto | undefined = undefined;
      const totalMatched = calculatedMatches.reduce((sum, match) => sum + match.quantity, 0);
      const remainingQuantity = takerOrder.quantity - totalMatched;

      if (remainingQuantity > 0) {
        // Update the existing taker order with the remaining quantity
        const updateSuccess = await this.orderDao.updateOrderQuantity(savedTakerOrderId, remainingQuantity);
        if (updateSuccess) {
          remainingOrder = {
            ...takerOrder,
            quantity: remainingQuantity,
          };

          // Update Redis after successful database commit
          await this.addOrderToRedisAtomically(
            marketId,
            remainingOrder.orderId,
            remainingOrder,
            remainingOrder.side,
            remainingOrder.price,
            remainingOrder.quantity,
          );
        }
      } else {
        // Order was fully matched - delete it from database
        await this.orderDao.deleteOrder(savedTakerOrderId);
      }

      // Calculate updated orders (partially filled orders) and completed orders
      const updatedOrders: Array<{ orderId: string; newQuantity: number }> = [];
      const completedOrderIds: string[] = [];
      
      for (const match of calculatedMatches) {
        const orderData = await this.orderDao.getOrderById(match.matchedOrderId);
        if (orderData) {
          const remainingQuantity = orderData.quantity - match.quantity;
          if (remainingQuantity > 0) {
            updatedOrders.push({
              orderId: match.matchedOrderId,
              newQuantity: remainingQuantity,
            });
          } else {
            completedOrderIds.push(match.matchedOrderId);
          }
        }
      }

      // Process matching results in Redis
      const matchingResult: OrderMatchingResultDto = {
        matches,
        completedOrderIds,
        updatedOrders,
        remainingOrder,
      };

      await this.processMatchingResults(marketId, matchingResult);

      // Emit events after successful commit
      for (const match of matches) {
        await this.eventService.publishOrderMatch(match);
      }

      return matchingResult;
    } catch (error) {
      this.logger.error(`Error processing order matching:`, error);
      throw error;
    }
  }

  /**
   * Create trades
   */
  private async createTrades(
    calculatedMatches: any[],
    matches: MatchResultDto[],
    marketId: string,
    order: Omit<OrderBookEntryDto, "timestamp">,
  ): Promise<void> {
    for (const match of calculatedMatches) {
      const tradeId = uuidv4();
      const tradeExecution: TradeExecutionDto = {
        tradeId,
        marketId,
        takerOrderId: order.orderId,
        makerOrderId: match.matchedOrderId,
        takerSide: order.side,
        price: match.price,
        quantity: match.quantity,
        type: "real" as TradeType,
        timestamp: new Date(),
        takerUserId: order.portfolioId,
        makerUserId: match.matchedPortfolioId,
      };

      await this.tradeDao.createTrade(tradeExecution);

      matches.push({
        marketId,
        takerOrderId: order.orderId,
        makerOrderId: match.matchedOrderId,
        takerSide: order.side,
        matchedQuantity: match.quantity,
        matchedPrice: match.price,
        timestamp: new Date(),
        takerRemainingQuantity: 0,
        makerRemainingQuantity: 0,
      });
    }
  }

  // ==================== REDIS OPERATIONS ====================

  /**
   * Add order to Redis atomically using aggregated structure
   */
  private async addOrderToRedisAtomically(
    marketId: string,
    orderId: string,
    orderData: any,
    side: "bid" | "ask",
    price: number,
    quantity: number,
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      const orderKey = `${this.ORDER_PREFIX}${orderId}`;
      const orderBookKey = `${this.ORDER_BOOK_PREFIX}${marketId}:${side}`;
      const score = side === "bid" ? -price : price;

      // Store individual order details (for recovery if needed)
      pipeline.set(orderKey, JSON.stringify(orderData));

      // Add quantity to price level in aggregated order book
      pipeline.zincrby(orderBookKey, quantity, score.toString());

      // Track market
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

      this.logger.debug(
        `Added ${quantity} to price level ${price} for ${side} in market ${marketId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error adding order ${orderId} to Redis atomically:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Remove quantity from Redis atomically
   */
  private async removeQuantityFromRedisAtomically(
    marketId: string,
    side: "bid" | "ask",
    price: number,
    quantity: number,
  ): Promise<void> {
    try {
      const orderBookKey = `${this.ORDER_BOOK_PREFIX}${marketId}:${side}`;
      const score = side === "bid" ? -price : price;

      // Decrease quantity at price level
      const newQuantity = await this.redis.zincrby(orderBookKey, -quantity, score.toString());
      
      // Remove price level if quantity becomes 0 or negative
      if (parseFloat(newQuantity) <= 0) {
        await this.redis.zrem(orderBookKey, score.toString());
      }

      this.logger.debug(
        `Removed ${quantity} from price level ${price} for ${side} in market ${marketId}, remaining: ${newQuantity}`,
      );
    } catch (error) {
      this.logger.error(
        `Error removing quantity from Redis atomically:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process matching results to update database and Redis
   */
  private async processMatchingResults(
    marketId: string,
    matchingResult: OrderMatchingResultDto,
  ): Promise<void> {
    try {
      // Process each matched order
      for (const match of matchingResult.matches) {
        // Get the current order from database
        const orderData = await this.orderDao.getOrderById(match.makerOrderId);
        if (orderData) {
          const remainingQuantity = orderData.quantity - match.matchedQuantity;
          
          if (remainingQuantity <= 0) {
            // Order is fully matched - delete it from database
            await this.orderDao.deleteOrder(match.makerOrderId);
            
            // Remove the full quantity from Redis
            await this.removeQuantityFromRedisAtomically(
              marketId,
              orderData.side,
              match.matchedPrice,
              orderData.quantity,
            );
          } else {
            // Order is partially matched - update quantity in database
            await this.orderDao.updateOrderQuantity(match.makerOrderId, remainingQuantity);
            
            // Remove only the matched quantity from Redis
            await this.removeQuantityFromRedisAtomically(
              marketId,
              orderData.side,
              match.matchedPrice,
              match.matchedQuantity,
            );
          }
        }
      }

      this.logger.debug(
        `Processed matching results for market ${marketId}: ${matchingResult.matches.length} matches`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing matching results for market ${marketId}:`,
        error,
      );
    }
  }

  // ==================== ORDER BOOK QUERIES ====================

  /**
   * Get orders by side from Redis (aggregated view)
   */
  private async getOrdersBySide(
    marketId: string,
    side: "bid" | "ask",
  ): Promise<OrderBookEntryDto[]> {
    try {
      const orderBookKey = `${this.ORDER_BOOK_PREFIX}${marketId}:${side}`;
      const rawEntries = await this.redis.zrange(orderBookKey, 0, -1, "WITHSCORES");

      const aggregatedOrders: OrderBookEntryDto[] = [];
      for (let i = 0; i < rawEntries.length; i += 2) {
        const scoreStr = rawEntries[i];
        const quantityStr = rawEntries[i + 1];
        const score = parseFloat(scoreStr);
        const quantity = parseFloat(quantityStr);
        const price = side === "bid" ? -score : score;

        if (quantity > 0) {
          aggregatedOrders.push({
            marketId,
            price,
            quantity,
            side,
            timestamp: new Date(),
            orderId: `aggregated-${marketId}-${side}-${price}`,
            portfolioId: "aggregated",
          });
        }
      }
      return aggregatedOrders;
    } catch (error) {
      this.logger.error(`Error getting ${side} orders for market ${marketId}:`, error);
      return [];
    }
  }

  /**
   * Get order book for a market
   */
  async getOrderBook(marketId: string): Promise<OrderBookDto> {
    try {
      const [bids, asks] = await Promise.all([
        this.getOrdersBySide(marketId, "bid"),
        this.getOrdersBySide(marketId, "ask"),
      ]);

      return {
        marketId,
        bids: bids.sort((a, b) => b.price - a.price), // Highest price first
        asks: asks.sort((a, b) => a.price - b.price), // Lowest price first
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error getting order book for market ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * Get market depth
   */
  async getDepth(marketId: string, levels: number = 10): Promise<OrderBookDto> {
    try {
      const [bids, asks] = await Promise.all([
        this.getOrdersBySide(marketId, "bid"),
        this.getOrdersBySide(marketId, "ask"),
      ]);

      return {
        marketId,
        bids: bids.sort((a, b) => b.price - a.price).slice(0, levels),
        asks: asks.sort((a, b) => a.price - b.price).slice(0, levels),
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error getting depth for market ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * Get best bid
   */
  async getBestBid(marketId: string): Promise<OrderBookEntryDto | null> {
    try {
      const orderBookKey = `${this.ORDER_BOOK_PREFIX}${marketId}:bid`;
      const result = await this.redis.zrange(orderBookKey, 0, 0, "WITHSCORES");
      
      if (result.length >= 2) {
        const score = parseFloat(result[0]);
        const quantity = parseFloat(result[1]);
        const price = -score; // Bids are stored with negative scores
        
        return {
          marketId,
          price,
          quantity,
          side: "bid",
          timestamp: new Date(),
          orderId: `best-bid-${marketId}`,
          portfolioId: "aggregated",
        };
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Error getting best bid for market ${marketId}:`, error);
      return null;
    }
  }

  /**
   * Get best ask
   */
  async getBestAsk(marketId: string): Promise<OrderBookEntryDto | null> {
    try {
      const orderBookKey = `${this.ORDER_BOOK_PREFIX}${marketId}:ask`;
      const result = await this.redis.zrange(orderBookKey, 0, 0, "WITHSCORES");
      
      if (result.length >= 2) {
        const score = parseFloat(result[0]);
        const quantity = parseFloat(result[1]);
        const price = score; // Asks are stored with positive scores
        
        return {
          marketId,
          price,
          quantity,
          side: "ask",
          timestamp: new Date(),
          orderId: `best-ask-${marketId}`,
          portfolioId: "aggregated",
        };
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Error getting best ask for market ${marketId}:`, error);
      return null;
    }
  }

  /**
   * Get spread for a market
   */
  async getSpread(marketId: string): Promise<number | null> {
    try {
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
   * Remove an order from the order book
   */
  async removeOrder(
    marketId: string,
    orderId: string,
    side: "bid" | "ask",
  ): Promise<boolean> {
    try {
      // Remove from database
      const deleted = await this.orderDao.deleteOrder(orderId);
      
      if (deleted) {
        // Remove from Redis
        const orderKey = `${this.ORDER_PREFIX}${orderId}`;
        const orderBookKey = `${this.ORDER_BOOK_PREFIX}${marketId}:${side}`;
        
        // Get order details to remove correct quantity
        const orderData = await this.redis.get(orderKey);
        if (orderData) {
          const order = JSON.parse(orderData);
          const score = side === "bid" ? -order.price : order.price;
          await this.redis.zincrby(orderBookKey, -order.quantity, score.toString());
          await this.redis.del(orderKey);
        }
      }
      
      return deleted;
    } catch (error) {
      this.logger.error(`Error removing order ${orderId} from market ${marketId}:`, error);
      return false;
    }
  }

  /**
   * Get recent trades for a market
   */
  async getRecentTrades(marketId: string, limit: number = 50): Promise<any[]> {
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
      this.logger.error(`Error getting recent trades for market ${marketId}:`, error);
      return [];
    }
  }

  /**
   * Get last trade price for a market
   */
  async getLastTradePrice(marketId: string): Promise<number | null> {
    try {
      return await this.tradeDao.getLastTradePrice(marketId);
    } catch (error) {
      this.logger.error(`Error getting last trade price for market ${marketId}:`, error);
      return null;
    }
  }

  /**
   * Check if market has an order book
   */
  async hasOrderBook(marketId: string): Promise<boolean> {
    try {
      // First check Redis for existing order books
      const marketIds = await this.redis.smembers(this.MARKET_IDS_KEY);
      if (marketIds.includes(marketId)) {
        return true;
      }

      // If not in Redis, check if market exists in database
      const marketExists = await this.orderDao.marketExists(marketId);
      if (marketExists) {
        // Market exists in DB but not in Redis - initialize empty order book in Redis
        await this.redis.sadd(this.MARKET_IDS_KEY, marketId);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error checking if market ${marketId} has order book:`, error);
      return false;
    }
  }

  /**
   * Initialize an empty order book for a new market
   */
  async initializeOrderBook(marketId: string): Promise<void> {
    try {
      // Add market to the list of markets with order books
      await this.redis.sadd(this.MARKET_IDS_KEY, marketId);
      
      // Initialize empty bid and ask order books
      const bidKey = `${this.ORDER_BOOK_PREFIX}${marketId}:bids`;
      const askKey = `${this.ORDER_BOOK_PREFIX}${marketId}:asks`;
      
      // Ensure the sorted sets exist (even if empty)
      await Promise.all([
        this.redis.zadd(bidKey, 0, "dummy"),
        this.redis.zadd(askKey, 0, "dummy"),
        this.redis.zrem(bidKey, "dummy"),
        this.redis.zrem(askKey, "dummy")
      ]);
      
      this.logger.debug(`Initialized order book for market ${marketId}`);
    } catch (error) {
      this.logger.error(`Error initializing order book for market ${marketId}:`, error);
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Validate if a string is a valid UUID
   */
  private isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Clear order book for a market
   */
  async clearOrderBook(marketId: string): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      
      // Clear both sides of the order book
      pipeline.del(`${this.ORDER_BOOK_PREFIX}${marketId}:bid`);
      pipeline.del(`${this.ORDER_BOOK_PREFIX}${marketId}:ask`);
      
      // Remove market from tracked markets
      pipeline.srem(this.MARKET_IDS_KEY, marketId);
      
      await pipeline.exec();
      
      // Also clear from database
      await this.orderDao.deleteOrdersByMarket(marketId);
      
      this.logger.debug(`Cleared order book for market ${marketId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error clearing order book for market ${marketId}:`, error);
      return false;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate matches between incoming order and existing orders
   */
  private calculateMatches(
    incomingOrder: Omit<OrderBookEntryDto, "timestamp">,
    existingOrders: OrderBookEntryDto[],
  ): any[] {
    const matches: any[] = [];
    let remainingQuantity = incomingOrder.quantity;

    for (const existingOrder of existingOrders) {
      if (remainingQuantity <= 0) break;

      const canMatch = incomingOrder.side === "bid" 
        ? incomingOrder.price >= existingOrder.price
        : incomingOrder.price <= existingOrder.price;

      if (canMatch) {
        const matchQuantity = Math.min(remainingQuantity, existingOrder.quantity);
        matches.push({
          matchedOrderId: existingOrder.orderId,
          matchedPortfolioId: existingOrder.portfolioId,
          price: existingOrder.price,
          quantity: matchQuantity,
        });
        remainingQuantity -= matchQuantity;
      }
    }

    return matches;
  }

  /**
   * Get opposing orders for matching
   */
  private async getOpposingOrdersInTransaction(
    marketId: string,
    side: "bid" | "ask",
    price: number,
    incomingSide: "bid" | "ask",
  ): Promise<OrderBookEntryDto[]> {
    try {
      const orders = await this.orderDao.getOrdersByMarketAndSideForMatching(
        marketId,
        side,
      );

      return orders.map(order => ({
        marketId: order.marketId,
        price: order.price,
        quantity: order.quantity,
        timestamp: order.createdAt,
        orderId: order.id,
        side: order.side,
        portfolioId: order.portfolioId,
      }));
    } catch (error) {
      this.logger.error("Error getting opposing orders:", error);
      return [];
    }
  }

  /**
   * Add a single order (used for remaining orders)
   */
  async addOrder(
    marketId: string,
    order: OrderBookEntryDto,
  ): Promise<boolean> {
    try {
      await this.addOrderToRedisAtomically(
        marketId,
        order.orderId,
        order,
        order.side,
        order.price,
        order.quantity,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error adding order to market ${marketId}:`, error);
      return false;
    }
  }

  /**
   * Get all market IDs
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
   * Clear all Redis data (for testing)
   */
  async clearAllRedisData(): Promise<void> {
    try {
      await this.redis.flushdb();
      this.logger.debug("Cleared all Redis data");
    } catch (error) {
      this.logger.error("Error clearing Redis data:", error);
    }
  }

  /**
   * Get order book statistics
   */
  async getOrderBookStats(marketId: string): Promise<any> {
    try {
      const [bestBid, bestAsk] = await Promise.all([
        this.getBestBid(marketId),
        this.getBestAsk(marketId),
      ]);

      const lastPrice = await this.getLastTradePrice(marketId);
      const recentTrades = await this.getRecentTrades(marketId, 100);
      
      const totalVolume = recentTrades.reduce((sum, trade) => sum + (trade.price * trade.quantity), 0);

      return {
        bestBid: bestBid?.price || null,
        bestAsk: bestAsk?.price || null,
        spread: bestBid && bestAsk ? bestAsk.price - bestBid.price : null,
        lastPrice,
        totalVolume,
        tradeCount: recentTrades.length,
      };
    } catch (error) {
      this.logger.error(`Error getting order book stats for market ${marketId}:`, error);
      return {
        bestBid: null,
        bestAsk: null,
        spread: null,
        lastPrice: null,
        totalVolume: 0,
        tradeCount: 0,
      };
    }
  }
}