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
import { MarketService } from "./market.service";
import { BaseTransaction } from "@/database/base-transaction";
import { Knex } from "knex";
import { OrderMatchingResultDto } from "../dtos/order/order-matching-result.dto";
import { MatchResultDto } from "../dtos/order/match-result.dto";
import { OrderMatchingRequestDto } from "../dtos/order/order-matching-request.dto";
import { BatchUpdateOrderDto } from "../dtos/order/batch-update-order.dto";
import { BatchOrderOperationDto } from "../dtos/order/batch-order-operation.dto";
import { BatchCreateTradeDto } from "../dtos/trade/batch-create-trade.dto";
import { TradeType } from "../types/trade-type";
import {
  InvalidPortfolioIdException,
  OrderCreationFailedException,
} from "../exceptions";
import { HttpException } from "@nestjs/common";

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
    private readonly marketService: MarketService,
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
   * Public for testing purposes
   */
  async restoreOrderBookForMarket(marketId: string): Promise<void> {
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
        throw new InvalidPortfolioIdException(order.portfolioId);
      }

      // First, save the incoming order to the database so it has a valid ID for trades
      const orderWithTimestamp = {
        ...order,
        timestamp: new Date(),
      };
      
      // Validate order data before processing
      if (order.side !== "bid" && order.side !== "ask") {
        throw new HttpException(
          {
            statusCode: 400,
            message: "Side must be either 'bid' or 'ask'",
            error: "Bad Request",
          },
          400,
        );
      }

      if (order.price <= 0 || !isFinite(order.price)) {
        throw new HttpException(
          {
            statusCode: 400,
            message: "Price must be a positive number",
            error: "Bad Request",
          },
          400,
        );
      }

      if (order.quantity <= 0 || !isFinite(order.quantity)) {
        throw new HttpException(
          {
            statusCode: 400,
            message: "Quantity must be greater than 0",
            error: "Bad Request",
          },
          400,
        );
      }

      // Get market to determine base/quote currency
      const market = await this.marketService.getMarketById(marketId);
      if (!market) {
        throw new HttpException(
          {
            statusCode: 404,
            message: `Market ${marketId} not found`,
            error: "Not Found",
          },
          404,
        );
      }

      // Validate and reserve holdings/balance before creating order
      if (order.side === "ask") {
        // For ASK orders (selling), need to reserve base currency holdings
        const reserved = await this.holdingDao.reserveHolding(
          order.portfolioId,
          marketId,
          order.quantity,
        );
        if (!reserved) {
          throw new HttpException(
            {
              statusCode: 400,
              message: `Insufficient holdings. You need ${order.quantity} ${market.baseCurrency} to place this sell order.`,
              error: "Bad Request",
            },
            400,
          );
        }
      } else {
        // For BID orders (buying), need to reserve quote currency balance
        const totalCost = order.price * order.quantity;
        const reserved = await this.portfolioDao.reserveBalance(
          order.portfolioId,
          totalCost,
        );
        if (!reserved) {
          throw new HttpException(
            {
              statusCode: 400,
              message: `Insufficient balance. You need ${totalCost} ${market.quoteCurrency} to place this buy order.`,
              error: "Bad Request",
            },
            400,
          );
        }
      }

      let savedTakerOrderId: string | null;
      try {
        savedTakerOrderId = await this.orderDao.createOrder(orderWithTimestamp);
      } catch (error: any) {
        // If order creation fails, restore the reserved holdings/balance
        if (order.side === "ask") {
          await this.holdingDao.adjustHoldingQuantity(
            order.portfolioId,
            marketId,
            order.quantity, // Restore by adding back
          );
        } else {
          const totalCost = order.price * order.quantity;
          await this.portfolioDao.adjustBalanceByPortfolioId(
            order.portfolioId,
            totalCost, // Restore by adding back
          );
        }
        
        // Catch database validation errors (e.g., invalid enum values) and convert to 400
        if (error?.code === '22P02' || error?.message?.includes('invalid input value for enum')) {
          throw new HttpException(
            {
              statusCode: 400,
              message: "Invalid order data: " + (error.message || "validation failed"),
              error: "Bad Request",
            },
            400,
          );
        }
        throw error;
      }
      
      if (!savedTakerOrderId) {
        // If order creation failed, restore the reserved holdings/balance
        if (order.side === "ask") {
          await this.holdingDao.adjustHoldingQuantity(
            order.portfolioId,
            marketId,
            order.quantity, // Restore by adding back
          );
        } else {
          const totalCost = order.price * order.quantity;
          await this.portfolioDao.adjustBalanceByPortfolioId(
            order.portfolioId,
            totalCost, // Restore by adding back
          );
        }
        throw new OrderCreationFailedException("Failed to save taker order to database");
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

      // Calculate matches between the incoming order and existing orders
      // Matches occur when: bid price >= ask price (or ask price <= bid price)
      // The match quantity is the minimum of remaining quantities
      const calculatedMatches = this.calculateMatches(takerOrder, opposingOrders);
      const matches: MatchResultDto[] = [];

      // If matches are found, create trades as acknowledgements that both sides have been filled
      // Each trade represents a completed match between the taker and maker orders
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

          // Restore holdings/balance for the unfilled portion
          if (order.side === "ask") {
            // Restore holdings for unfilled quantity
            await this.holdingDao.adjustHoldingQuantity(
              order.portfolioId,
              marketId,
              remainingQuantity, // Restore by adding back
            );
          } else {
            // Restore balance for unfilled quantity
            const remainingCost = order.price * remainingQuantity;
            await this.portfolioDao.adjustBalanceByPortfolioId(
              order.portfolioId,
              remainingCost, // Restore by adding back
            );
          }

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
        // Order was fully matched - set quantity to 0 instead of deleting
        // This allows the order to remain in the database for historical purposes (trades reference it)
        // but prevents it from being matched again (filtered out by quantity > 0)
        await this.orderDao.updateOrderQuantity(savedTakerOrderId, 0);
        
        // Remove from Redis since the order is fully matched
        const orderKey = `${this.ORDER_PREFIX}${savedTakerOrderId}`;
        const orderBookKey = `${this.ORDER_BOOK_PREFIX}${marketId}:${order.side}`;
        const score = order.side === "bid" ? -order.price : order.price;
        
        // Remove the full quantity from Redis
        await this.removeQuantityFromRedisAtomically(
          marketId,
          order.side,
          order.price,
          order.quantity,
        );
        
        // Remove the individual order entry from Redis
        await this.redis.del(orderKey);
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
   * Create trades as acknowledgements that both sides of an order have been filled
   * 
   * When two orders match (price matches and quantity matches), a trade is created
   * to acknowledge that both the taker and maker orders have been filled.
   * 
   * This method:
   * 1. Creates a trade record for each match
   * 2. Updates holdings/balances for both parties
   * 3. Returns match results for further processing
   */
  private async createTrades(
    calculatedMatches: any[],
    matches: MatchResultDto[],
    marketId: string,
    order: Omit<OrderBookEntryDto, "timestamp">,
  ): Promise<void> {
    // Get market to determine base/quote currency
    const market = await this.marketService.getMarketById(marketId);
    if (!market) {
      this.logger.error(`Market ${marketId} not found when creating trades`);
      return;
    }

    for (const match of calculatedMatches) {
      // Get maker order to determine maker side
      const makerOrder = await this.orderDao.getOrderById(match.matchedOrderId);
      if (!makerOrder) {
        this.logger.error(`Maker order ${match.matchedOrderId} not found`);
        continue;
      }

      // Get user IDs from portfolios for filtering and holding creation
      const takerPortfolio = await this.portfolioDao.getPortfolioById(order.portfolioId);
      const makerPortfolio = await this.portfolioDao.getPortfolioById(match.matchedPortfolioId);

      // Get or create holdings for both taker and maker (pass userId for efficiency)
      const takerHoldingId = await this.holdingDao.getOrCreateHoldingId(
        order.portfolioId,
        marketId,
        takerPortfolio?.userId,
      );
      const makerHoldingId = await this.holdingDao.getOrCreateHoldingId(
        match.matchedPortfolioId,
        marketId,
        makerPortfolio?.userId,
      );

      // Update holdings/balances based on trade
      const tradeValue = match.price * match.quantity;

      if (order.side === "bid") {
        // Taker is buying: Holdings were already reserved, now add holdings
        // Holdings were already deducted from reservation, so we need to add them back plus the purchased amount
        // Actually, for BID orders, balance was reserved, not holdings
        // So: balance was deducted, now add holdings
        await this.holdingDao.adjustHoldingQuantity(
          order.portfolioId,
          marketId,
          match.quantity, // Add purchased holdings
        );
        // Update cost basis for taker (buyer)
        await this.holdingDao.updateCostBasisOnPurchase(
          order.portfolioId,
          marketId,
          match.quantity,
          match.price,
        );

        // Maker is selling: Add cash (quote currency balance)
        await this.portfolioDao.adjustBalanceByPortfolioId(
          match.matchedPortfolioId,
          tradeValue, // Add cash from sale
        );
        // Update cost basis for maker (seller) - reduce cost basis proportionally
        await this.holdingDao.updateCostBasisOnSale(
          match.matchedPortfolioId,
          marketId,
          match.quantity,
        );
      } else {
        // Taker is selling: Holdings were already reserved (deducted) when order was placed
        // The holdings are already gone, so we just add cash from the sale
        await this.portfolioDao.adjustBalanceByPortfolioId(
          order.portfolioId,
          tradeValue, // Add cash from sale
        );
        // Update cost basis for taker (seller) - reduce cost basis proportionally
        await this.holdingDao.updateCostBasisOnSale(
          order.portfolioId,
          marketId,
          match.quantity,
        );

        // Maker is buying: Add holdings (base currency) to the maker's portfolio
        // Note: If maker and taker are the same portfolio, this will add back what was deducted
        // which is correct - they sold and bought back, so net holdings should be unchanged
        await this.holdingDao.adjustHoldingQuantity(
          match.matchedPortfolioId,
          marketId,
          match.quantity, // Add purchased holdings
        );
        // Update cost basis for maker (buyer)
        await this.holdingDao.updateCostBasisOnPurchase(
          match.matchedPortfolioId,
          marketId,
          match.quantity,
          match.price,
        );
      }

      const tradeId = uuidv4();
      const tradeExecution: TradeExecutionDto = {
        tradeId,
        marketId,
        takerOrderId: order.orderId,
        makerOrderId: match.matchedOrderId,
        price: match.price,
        quantity: match.quantity,
        type: "real" as TradeType,
        timestamp: new Date(),
        takerHoldingId: takerHoldingId || undefined,
        makerHoldingId: makerHoldingId || undefined,
        takerUserId: takerPortfolio?.userId,
        makerUserId: makerPortfolio?.userId,
        takerPortfolioId: order.portfolioId,
        makerPortfolioId: match.matchedPortfolioId,
      };

      const tradeResult = await this.tradeDao.createTrade(tradeExecution);
      if (!tradeResult) {
        this.logger.error(`Failed to create trade for order ${order.orderId} matching with ${match.matchedOrderId}`);
        // Continue processing other matches even if one fails
        continue;
      }

      matches.push({
        marketId,
        takerOrderId: order.orderId,
        makerOrderId: match.matchedOrderId,
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
      // Get market to determine base/quote currency
      const market = await this.marketService.getMarketById(marketId);
      if (!market) {
        this.logger.error(`Market ${marketId} not found when processing matching results`);
        return;
      }

      // Process each matched order
      for (const match of matchingResult.matches) {
        // Get the current order from database
        const orderData = await this.orderDao.getOrderById(match.makerOrderId);
        if (orderData) {
          const remainingQuantity = orderData.quantity - match.matchedQuantity;
          
          if (remainingQuantity <= 0) {
            // Order is fully matched - set quantity to 0 instead of deleting
            // This allows the order to remain in the database for historical purposes (trades reference it)
            // but prevents it from being matched again (filtered out by quantity > 0)
            await this.orderDao.updateOrderQuantity(match.makerOrderId, 0);
            
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
            
            // Restore holdings/balance for the unfilled portion of maker order
            if (orderData.side === "ask") {
              // Restore holdings for unfilled quantity
              await this.holdingDao.adjustHoldingQuantity(
                orderData.portfolioId,
                marketId,
                remainingQuantity, // Restore by adding back
              );
            } else {
              // Restore balance for unfilled quantity
              const remainingCost = orderData.price * remainingQuantity;
              await this.portfolioDao.adjustBalanceByPortfolioId(
                orderData.portfolioId,
                remainingCost, // Restore by adding back
              );
            }
            
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
   * Remove an order from the order book and restore holdings/balance
   */
  async removeOrder(
    marketId: string,
    orderId: string,
    side: "bid" | "ask",
  ): Promise<boolean> {
    try {
      // Get order details from database before deleting
      const orderData = await this.orderDao.getOrderById(orderId);
      if (!orderData) {
        return false;
      }

      // Get market to determine base/quote currency
      const market = await this.marketService.getMarketById(marketId);
      if (!market) {
        this.logger.error(`Market ${marketId} not found when removing order`);
        return false;
      }

      // Restore holdings/balance for the remaining order quantity
      if (side === "ask") {
        // Restore holdings for ASK orders (selling)
        await this.holdingDao.adjustHoldingQuantity(
          orderData.portfolioId,
          marketId,
          orderData.quantity, // Restore by adding back
        );
      } else {
        // Restore balance for BID orders (buying)
        const totalCost = orderData.price * orderData.quantity;
        await this.portfolioDao.adjustBalanceByPortfolioId(
          orderData.portfolioId,
          totalCost, // Restore by adding back
        );
      }

      // Remove from database
      const deleted = await this.orderDao.deleteOrder(orderId);
      
      if (deleted) {
        // Remove from Redis
        const orderKey = `${this.ORDER_PREFIX}${orderId}`;
        const orderBookKey = `${this.ORDER_BOOK_PREFIX}${marketId}:${side}`;
        
        // Get order details to remove correct quantity
        const redisOrderData = await this.redis.get(orderKey);
        if (redisOrderData) {
          const order = JSON.parse(redisOrderData);
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
        type: trade.type,
        quantity: trade.quantity,
        price: trade.price,
        timestamp: trade.createdAt,
        createdAt: trade.createdAt, // Also include createdAt for backward compatibility
        takerUserId: trade.takerUserId,
        makerUserId: trade.makerUserId,
        takerPortfolioId: trade.takerPortfolioId,
        makerPortfolioId: trade.makerPortfolioId,
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
   * This also restores reserved balance and holdings for all deleted orders
   */
  async clearOrderBook(marketId: string): Promise<boolean> {
    try {
      // Get all orders for this market before deleting them
      // We need to restore balance/holdings for each order
      const bidOrders = await this.orderDao.getOrdersByMarketAndSideForMatching(marketId, "bid");
      const askOrders = await this.orderDao.getOrdersByMarketAndSideForMatching(marketId, "ask");
      
      // Get market to determine base/quote currency
      const market = await this.marketService.getMarketById(marketId);
      if (!market) {
        this.logger.error(`Market ${marketId} not found when clearing order book`);
        return false;
      }

      // Restore balance for all BID orders (buying orders that reserved balance)
      for (const order of bidOrders) {
        const totalCost = order.price * order.quantity;
        await this.portfolioDao.adjustBalanceByPortfolioId(
          order.portfolioId,
          totalCost, // Restore by adding back
        );
      }

      // Restore holdings for all ASK orders (selling orders that reserved holdings)
      for (const order of askOrders) {
        await this.holdingDao.adjustHoldingQuantity(
          order.portfolioId,
          marketId,
          order.quantity, // Restore by adding back
        );
      }

      const pipeline = this.redis.pipeline();
      
      // Clear both sides of the order book
      pipeline.del(`${this.ORDER_BOOK_PREFIX}${marketId}:bid`);
      pipeline.del(`${this.ORDER_BOOK_PREFIX}${marketId}:ask`);
      
      // Remove market from tracked markets
      pipeline.srem(this.MARKET_IDS_KEY, marketId);
      
      await pipeline.exec();
      
      // Delete trades first to avoid foreign key constraint violations
      await this.tradeDao.deleteTradesByMarket(marketId);
      
      // Then clear from database
      await this.orderDao.deleteOrdersByMarket(marketId);
      
      this.logger.debug(`Cleared order book for market ${marketId} and restored balance/holdings`);
      return true;
    } catch (error) {
      this.logger.error(`Error clearing order book for market ${marketId}:`, error);
      return false;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate matches between incoming order and existing orders
   * 
   * Matching rules:
   * - A bid (buy) order matches an ask (sell) order when bid.price >= ask.price
   * - An ask (sell) order matches a bid (buy) order when ask.price <= bid.price
   * - Match quantity is the minimum of the remaining quantities
   * - Orders are matched in price-time priority (best price first, then earliest time)
   * 
   * @returns Array of matches, each containing the matched order ID, portfolio ID, price, and quantity
   */
  private calculateMatches(
    incomingOrder: Omit<OrderBookEntryDto, "timestamp">,
    existingOrders: OrderBookEntryDto[],
  ): any[] {
    const matches: any[] = [];
    let remainingQuantity = incomingOrder.quantity;

    for (const existingOrder of existingOrders) {
      if (remainingQuantity <= 0) break;

      // Check if prices match: bid matches ask when bid.price >= ask.price
      // and ask matches bid when ask.price <= bid.price
      const canMatch = incomingOrder.side === "bid" 
        ? incomingOrder.price >= existingOrder.price
        : incomingOrder.price <= existingOrder.price;

      if (canMatch) {
        // Match quantity is the minimum of what's remaining in both orders
        const matchQuantity = Math.min(remainingQuantity, existingOrder.quantity);
        matches.push({
          matchedOrderId: existingOrder.orderId,
          matchedPortfolioId: existingOrder.portfolioId,
          price: existingOrder.price, // Use maker's price (price-time priority)
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