import { v4 as uuidv4 } from "uuid";
import { CreateMarketDto } from "../../src/modules/exchange/dtos/market/create-market.dto";
import { CreateAssetDto } from "../../src/modules/assets/dtos/create-asset.dto";
import { OrderBookEntryDto } from "../../src/modules/exchange/dtos/order/order-book-entry.dto";

export class TestDataHelper {
  /**
   * Create test asset data
   */
  static createTestAsset(overrides: Partial<CreateAssetDto> = {}): CreateAssetDto {
    return {
      symbol: "TEST",
      name: "Test Asset",
      type: "crypto",
      decimals: 8,
      isActive: true,
      ...overrides,
    };
  }

  /**
   * Create test market data
   * Note: baseAsset and quoteAsset should be asset symbols, and baseAssetId/quoteAssetId should be set
   */
  static createTestMarket(overrides: Partial<CreateMarketDto> = {}): CreateMarketDto {
    return {
      name: "Test Market",
      symbol: "TEST/USD",
      category: "crypto",
      baseAsset: "TEST",
      quoteAsset: "USD",
      baseAssetId: "", // Must be set from created asset
      quoteAssetId: "", // Must be set from created asset
      minPriceIncrement: 0.01,
      minQuantityIncrement: 0.001,
      maxQuantity: 100,
      isActive: true,
      is24h: true,
      timezone: "UTC",
      ...overrides,
    };
  }

  /**
   * Create test order data
   */
  static createTestOrder(
    marketId: string,
    userId: string,
    quoteAssetId: string,
    overrides: Partial<Omit<OrderBookEntryDto, "timestamp">> = {}
  ): Omit<OrderBookEntryDto, "timestamp"> {
    return {
      marketId,
      orderId: uuidv4(),
      side: "bid",
      price: 50000,
      quantity: 1.0,
      userId,
      quoteAssetId,
      ...overrides,
    };
  }

  /**
   * Create multiple test orders for building market depth
   */
  static createMarketDepthOrders(
    marketId: string,
    bidderUserId: string,
    askerUserId: string,
    quoteAssetId: string
  ): {
    bids: Omit<OrderBookEntryDto, "timestamp">[];
    asks: Omit<OrderBookEntryDto, "timestamp">[];
  } {
    const bids = [
      this.createTestOrder(marketId, bidderUserId, quoteAssetId, {
        side: "bid",
        price: 50000,
        quantity: 1.5,
      }),
      this.createTestOrder(marketId, bidderUserId, quoteAssetId, {
        side: "bid",
        price: 49500,
        quantity: 2.0,
      }),
      this.createTestOrder(marketId, bidderUserId, quoteAssetId, {
        side: "bid",
        price: 49000,
        quantity: 1.0,
      }),
    ];

    const asks = [
      this.createTestOrder(marketId, askerUserId, quoteAssetId, {
        side: "ask",
        price: 51000,
        quantity: 1.2,
      }),
      this.createTestOrder(marketId, askerUserId, quoteAssetId, {
        side: "ask",
        price: 51500,
        quantity: 2.5,
      }),
      this.createTestOrder(marketId, askerUserId, quoteAssetId, {
        side: "ask",
        price: 52000,
        quantity: 3.0,
      }),
    ];

    return { bids, asks };
  }

  /**
   * Create orders that will result in matches
   */
  static createMatchingOrders(
    marketId: string,
    userId1: string,
    userId2: string,
    quoteAssetId: string
  ): {
    makerOrder: Omit<OrderBookEntryDto, "timestamp">;
    takerOrder: Omit<OrderBookEntryDto, "timestamp">;
  } {
    const makerOrder = this.createTestOrder(marketId, userId1, quoteAssetId, {
      side: "ask",
      price: 50000,
      quantity: 2.0,
    });

    const takerOrder = this.createTestOrder(marketId, userId2, quoteAssetId, {
      side: "bid",
      price: 50000,
      quantity: 1.5, // Partial fill
    });

    return { makerOrder, takerOrder };
  }

  /**
   * Create orders for testing price-time priority
   */
  static createPriorityTestOrders(
    marketId: string,
    askerUserId: string,
    bidderUserId: string,
    quoteAssetId: string
  ): {
    orders: Omit<OrderBookEntryDto, "timestamp">[];
    matchingOrder: Omit<OrderBookEntryDto, "timestamp">;
  } {
    // Create orders at same price but different times (simulated by order)
    const orders = [
      this.createTestOrder(marketId, askerUserId, quoteAssetId, {
        side: "ask",
        price: 50000,
        quantity: 1.0,
        orderId: "order-1", // First in time
      }),
      this.createTestOrder(marketId, askerUserId, quoteAssetId, {
        side: "ask",
        price: 50000,
        quantity: 1.5,
        orderId: "order-2", // Second in time
      }),
    ];

    const matchingOrder = this.createTestOrder(marketId, bidderUserId, quoteAssetId, {
      side: "bid",
      price: 50000,
      quantity: 1.0, // Should match with order-1 due to time priority
    });

    return { orders, matchingOrder };
  }

  /**
   * Generate unique market symbols for testing
   */
  static generateUniqueSymbol(base: string = "TEST"): string {
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${base}${suffix}/USD`;
  }

  /**
   * Create test data for stress testing
   */
  static createStressTestData(
    marketId: string,
    bidderUserId: string,
    quoteAssetId: string,
    orderCount: number = 100,
    askerUserId?: string
  ): Omit<OrderBookEntryDto, "timestamp">[] {
    const askerUser = askerUserId || bidderUserId;
    const orders: Omit<OrderBookEntryDto, "timestamp">[] = [];

    for (let i = 0; i < orderCount; i++) {
      const side = i % 2 === 0 ? "bid" : "ask";
      const basePrice = 50000;
      const priceVariation = (Math.random() - 0.5) * 1000; // ±500 price variation
      const price = Math.round((basePrice + priceVariation) * 100) / 100;
      const quantity = Math.round((Math.random() * 5 + 0.1) * 1000) / 1000;

      orders.push(
        this.createTestOrder(marketId, side === "bid" ? bidderUserId : askerUser, quoteAssetId, {
          side,
          price,
          quantity,
          orderId: `stress-test-order-${i}`,
        })
      );
    }

    return orders;
  }

  /**
   * Validate order book structure
   */
  static validateOrderBook(orderBook: any): boolean {
    if (!orderBook || typeof orderBook !== "object") {
      return false;
    }

    // Check required properties
    if (!orderBook.marketId || !Array.isArray(orderBook.bids) || !Array.isArray(orderBook.asks)) {
      return false;
    }

    // Check bid sorting (descending by price)
    for (let i = 1; i < orderBook.bids.length; i++) {
      if (orderBook.bids[i].price > orderBook.bids[i - 1].price) {
        return false;
      }
    }

    // Check ask sorting (ascending by price)
    for (let i = 1; i < orderBook.asks.length; i++) {
      if (orderBook.asks[i].price < orderBook.asks[i - 1].price) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate expected spread
   */
  static calculateSpread(orderBook: any): number | null {
    if (!orderBook.bids.length || !orderBook.asks.length) {
      return null;
    }

    const bestBid = orderBook.bids[0].price;
    const bestAsk = orderBook.asks[0].price;
    
    return bestAsk - bestBid;
  }

  /**
   * Calculate total volume at price level
   */
  static calculateVolumeAtPrice(orders: any[], price: number): number {
    return orders
      .filter(order => order.price === price)
      .reduce((total, order) => total + order.quantity, 0);
  }
}

export default TestDataHelper;
