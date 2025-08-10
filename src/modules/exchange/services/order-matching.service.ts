import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { TradeDao } from "../daos/trade.dao";
import { OrderDao } from "../daos/order.dao";
import { EventService } from "./event.service";
import { OrderMatchingRequestDto } from "../dtos/order-matching/order-matching-request.dto";
import { OrderMatchingResultDto } from "../dtos/order-matching/order-matching-result.dto";
import { MatchResultDto } from "../dtos/order-matching/match-result.dto";
import { OrderBookEntryDto } from "../dtos/order-book/order-book-entry.dto";
import { TradeExecutionDto } from "../dtos/trade/trade-execution.dto";

@Injectable()
export class OrderMatchingService {
  private readonly logger = new Logger(OrderMatchingService.name);

  constructor(
    private readonly tradeDao: TradeDao,
    private readonly orderDao: OrderDao,
    private readonly eventService: EventService,
  ) {}

  /**
   * Process an incoming order and attempt to match it against existing orders
   * Uses price-time priority matching algorithm with atomic transaction safety
   */
  async processOrderMatching(
    request: OrderMatchingRequestDto,
  ): Promise<OrderMatchingResultDto> {
    const { marketId, incomingOrder } = request;

    // Use database transaction to ensure atomicity
    return await this.orderDao
      .transaction(async (trx) => {
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

          // Match against existing orders
          for (const existingOrder of opposingOrders) {
            if (remainingIncomingQuantity <= 0) {
              break;
            }

            // Check if orders can be matched based on price
            if (!this.canOrdersMatch(incomingOrder, existingOrder)) {
              break; // Since orders are sorted by price, no further matches possible
            }

            // Calculate match details
            const matchedQuantity = Math.min(
              remainingIncomingQuantity,
              existingOrder.quantity,
            );

            const matchedPrice = this.determineMatchPrice(
              incomingOrder,
              existingOrder,
            );

            // Create match result
            const match: MatchResultDto = {
              marketId,
              takerOrderId: incomingOrder.orderId, // Incoming order is always the taker
              makerOrderId: existingOrder.orderId, // Existing order is always the maker
              takerSide: incomingOrder.side,
              matchedQuantity,
              matchedPrice,
              timestamp: new Date(),
              takerRemainingQuantity:
                remainingIncomingQuantity - matchedQuantity,
              makerRemainingQuantity: existingOrder.quantity - matchedQuantity,
            };

            matches.push(match);

            // Queue events for after transaction commit
            pendingEvents.push({
              type: "orderMatch",
              data: match,
            });

            // Update quantities
            remainingIncomingQuantity -= matchedQuantity;
            const remainingExistingQuantity =
              existingOrder.quantity - matchedQuantity;

            // Handle existing order updates (within transaction)
            if (remainingExistingQuantity > 0) {
              // Partially filled - update the order
              updatedOrders.push({
                orderId: existingOrder.orderId,
                newQuantity: remainingExistingQuantity,
              });

              // Update in database (within transaction)
              await this.orderDao
                .transacting(trx)
                .updateOrderQuantity(
                  existingOrder.orderId,
                  remainingExistingQuantity,
                );

              // Queue partial fill event for existing order
              pendingEvents.push({
                type: "orderFill",
                data: {
                  orderId: existingOrder.orderId,
                  marketId,
                  side: existingOrder.side,
                  filledQuantity: matchedQuantity,
                  remainingQuantity: remainingExistingQuantity,
                  fillPrice: matchedPrice,
                  isComplete: false,
                },
              });
            } else {
              // Completely filled - mark for removal
              completedOrderIds.push(existingOrder.orderId);

              // Remove from database (within transaction)
              await this.orderDao
                .transacting(trx)
                .deleteOrder(existingOrder.orderId);

              // Queue complete fill event for existing order
              pendingEvents.push({
                type: "orderFill",
                data: {
                  orderId: existingOrder.orderId,
                  marketId,
                  side: existingOrder.side,
                  filledQuantity: matchedQuantity,
                  remainingQuantity: 0,
                  fillPrice: matchedPrice,
                  isComplete: true,
                },
              });
            }

            // Queue fill event for incoming order
            const incomingOrderRemaining = remainingIncomingQuantity;
            pendingEvents.push({
              type: "orderFill",
              data: {
                orderId: incomingOrder.orderId,
                marketId,
                side: incomingOrder.side,
                filledQuantity: matchedQuantity,
                remainingQuantity: incomingOrderRemaining,
                fillPrice: matchedPrice,
                isComplete: incomingOrderRemaining === 0,
              },
            });

            // Store trade execution (within transaction)
            await this.storeTradeInTransaction(match, trx);
          }

          // Handle remaining incoming order
          if (remainingIncomingQuantity > 0) {
            remainingOrder = {
              ...incomingOrder,
              quantity: remainingIncomingQuantity,
              timestamp: new Date(),
            };
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
      })
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
          },
          updatedOrders: [],
          completedOrderIds: [],
        };
      });
  }

  /**
   * Get opposing orders sorted by price-time priority (within transaction)
   */
  private async getOpposingOrdersInTransaction(
    marketId: string,
    incomingSide: "bid" | "ask",
    trx: any,
  ): Promise<OrderBookEntryDto[]> {
    const opposingSide = incomingSide === "bid" ? "ask" : "bid";

    let orderDao: OrderDao = this.orderDao;

    if (trx) {
      orderDao = this.orderDao.transacting(trx);
    }

    const orders = await orderDao.getOrdersByMarketAndSide(
      marketId,
      opposingSide,
    );

    // Convert database records to OrderBookEntry objects
    return orders.map((order) => ({
      marketId: order.market_id,
      price: parseFloat(order.price),
      quantity: parseFloat(order.quantity),
      timestamp: order.created_at,
      orderId: order.id,
      side: order.side,
    }));
  }

  /**
   * Get opposing orders sorted by price-time priority (non-transactional fallback)
   */
  private async getOpposingOrders(
    marketId: string,
    incomingSide: "bid" | "ask",
  ): Promise<OrderBookEntryDto[]> {
    const opposingSide = incomingSide === "bid" ? "ask" : "bid";

    const orders = await this.orderDao.getOrdersByMarketAndSide(
      marketId,
      opposingSide,
    );

    // Convert database records to OrderBookEntry objects
    return orders.map((order) => ({
      marketId: order.market_id,
      price: parseFloat(order.price),
      quantity: parseFloat(order.quantity),
      timestamp: order.created_at,
      orderId: order.id,
      side: order.side,
    }));
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
   * Store trade execution in database (within transaction)
   */
  private async storeTradeInTransaction(
    match: MatchResultDto,
    trx: any,
  ): Promise<TradeExecutionDto> {
    const trade: TradeExecutionDto = {
      tradeId: uuidv4(),
      marketId: match.marketId,
      takerOrderId: match.takerOrderId,
      makerOrderId: match.makerOrderId,
      takerSide: match.takerSide,
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
   * Store trade execution in database (non-transactional fallback)
   */
  private async storeTrade(match: MatchResultDto): Promise<void> {
    const trade: TradeExecutionDto = {
      tradeId: uuidv4(),
      marketId: match.marketId,
      takerOrderId: match.takerOrderId,
      makerOrderId: match.makerOrderId,
      takerSide: match.takerSide,
      quantity: match.matchedQuantity,
      price: match.matchedPrice,
      timestamp: match.timestamp,
    };

    await this.tradeDao.createTrade(trade);

    // Publish trade execution event
    await this.eventService.publishTradeExecution(trade);

    this.logger.debug(
      `Stored trade: ${trade.quantity} @ ${trade.price} for market ${trade.marketId} (taker: ${trade.takerSide})`,
    );
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

  /**
   * Get recent trades for a market
   */
  async getRecentTrades(
    marketId: string,
    limit: number = 50,
  ): Promise<TradeExecutionDto[]> {
    const trades = await this.tradeDao.getRecentTrades(marketId, limit);

    return trades.map((trade) => ({
      tradeId: trade.trade_id,
      marketId: trade.market_id,
      takerOrderId: trade.taker_order_id,
      makerOrderId: trade.maker_order_id,
      takerSide: trade.taker_side,
      quantity: parseFloat(trade.quantity),
      price: parseFloat(trade.price),
      timestamp: trade.created_at,
      takerUserId: trade.taker_user_id,
      makerUserId: trade.maker_user_id,
    }));
  }

  /**
   * Get the last trade price for a market
   */
  async getLastTradePrice(marketId: string): Promise<number | null> {
    return await this.tradeDao.getLastTradePrice(marketId);
  }
}
