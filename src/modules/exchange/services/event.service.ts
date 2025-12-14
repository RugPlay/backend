import { Injectable, Logger } from "@nestjs/common";
import { OrderMatchEvent } from "../events/order/order-match.event";
import { OrderFillEvent } from "../events/order/order-fill.event";
import { TradeExecutionEvent } from "../events/trade/trade-execution.event";
import { TradeExecutionDto } from "../dtos/trade/trade-execution.dto";
import { MatchResultDto } from "../dtos/order/match-result.dto";

type SimulatorEvent = OrderMatchEvent | OrderFillEvent | TradeExecutionEvent;

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);
  private readonly eventHandlers = new Map<string, Set<(event: any) => void>>();

  /**
   * Subscribe to a specific event type
   */
  subscribe<T extends SimulatorEvent>(
    eventType: T["eventType"],
    handler: (event: T) => void,
  ): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)!.add(handler as (event: any) => void);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler as (event: any) => void);
      }
    };
  }

  /**
   * Publish an event to all subscribers
   */
  private publish<T extends SimulatorEvent>(event: T): void {
    const handlers = this.eventHandlers.get(event.eventType);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          this.logger.error(`Error handling event ${event.eventType}:`, error);
        }
      });
    }
  }

  /**
   * Publish an order match event
   */
  async publishOrderMatch(match: MatchResultDto): Promise<void> {
    const event = new OrderMatchEvent(match);
    this.publish(event);

    this.logger.debug(
      `Published order match event: ${match.takerOrderId} <-> ${match.makerOrderId} ` +
        `(${match.matchedQuantity} @ ${match.matchedPrice})`,
    );
  }

  /**
   * Publish an order fill event
   */
  async publishOrderFill(
    orderId: string,
    marketId: string,
    side: "bid" | "ask",
    filledQuantity: number,
    remainingQuantity: number,
    fillPrice: number,
    isComplete: boolean,
  ): Promise<void> {
    const event = new OrderFillEvent(
      orderId,
      marketId,
      side,
      filledQuantity,
      remainingQuantity,
      fillPrice,
      isComplete,
    );
    this.publish(event);

    this.logger.debug(
      `Published order fill event: ${orderId} filled ${filledQuantity} @ ${fillPrice} ` +
        `(remaining: ${remainingQuantity}, complete: ${isComplete})`,
    );
  }

  /**
   * Publish a trade execution event
   */
  async publishTradeExecution(trade: TradeExecutionDto): Promise<void> {
    const event = new TradeExecutionEvent(trade);
    this.publish(event);

    this.logger.debug(
      `Published trade execution event: ${trade.tradeId} ` +
        `(${trade.quantity} @ ${trade.price})`,
    );
  }

  /**
   * Get the number of subscribers for an event type
   */
  getSubscriberCount(eventType: string): number {
    return this.eventHandlers.get(eventType)?.size || 0;
  }

  /**
   * Clear all event handlers (useful for testing)
   */
  clearAllHandlers(): void {
    this.eventHandlers.clear();
  }
}
