import { v4 as uuidv4 } from "uuid";
import { CreateMarketDto } from "../../src/modules/exchange/dtos/market/create-market.dto";
import { CreatePortfolioDto } from "../../src/modules/portfolio/dtos/create-portfolio.dto";
import { OrderBookEntryDto } from "../../src/modules/exchange/dtos/order/order-book-entry.dto";

export class TestDataHelper {
  /**
   * Create test market data
   */
  static createTestMarket(overrides: Partial<CreateMarketDto> = {}): CreateMarketDto {
    return {
      name: "Test Market",
      symbol: "TEST/USD",
      category: "crypto",
      baseCurrency: "TEST",
      quoteCurrency: "USD",
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
   * Create test portfolio data
   */
  static createTestPortfolio(overrides: Partial<CreatePortfolioDto> = {}): CreatePortfolioDto {
    return {
      balance: 100000, // $100k starting balance
      type: "real",
      ...overrides,
    };
  }


  /**
   * Create test order data
   */
  static createTestOrder(
    marketId: string,
    portfolioId: string,
    overrides: Partial<Omit<OrderBookEntryDto, "timestamp">> = {}
  ): Omit<OrderBookEntryDto, "timestamp"> {
    return {
      marketId,
      orderId: uuidv4(),
      side: "bid",
      price: 50000,
      quantity: 1.0,
      portfolioId,
      ...overrides,
    };
  }

  /**
   * Create multiple test orders for building market depth
   */
  static createMarketDepthOrders(
    marketId: string,
    bidderPortfolioId: string,
    askerPortfolioId?: string
  ): {
    bids: Omit<OrderBookEntryDto, "timestamp">[];
    asks: Omit<OrderBookEntryDto, "timestamp">[];
  } {
    const askerPortfolio = askerPortfolioId || bidderPortfolioId;
    const bids = [
      this.createTestOrder(marketId, bidderPortfolioId, {
        side: "bid",
        price: 50000,
        quantity: 1.5,
      }),
      this.createTestOrder(marketId, bidderPortfolioId, {
        side: "bid",
        price: 49500,
        quantity: 2.0,
      }),
      this.createTestOrder(marketId, bidderPortfolioId, {
        side: "bid",
        price: 49000,
        quantity: 1.0,
      }),
    ];

    const asks = [
      this.createTestOrder(marketId, askerPortfolio, {
        side: "ask",
        price: 51000,
        quantity: 1.2,
      }),
      this.createTestOrder(marketId, askerPortfolio, {
        side: "ask",
        price: 51500,
        quantity: 2.5,
      }),
      this.createTestOrder(marketId, askerPortfolio, {
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
    portfolioId1: string,
    portfolioId2: string
  ): {
    makerOrder: Omit<OrderBookEntryDto, "timestamp">;
    takerOrder: Omit<OrderBookEntryDto, "timestamp">;
  } {
    const makerOrder = this.createTestOrder(marketId, portfolioId1, {
      side: "ask",
      price: 50000,
      quantity: 2.0,
    });

    const takerOrder = this.createTestOrder(marketId, portfolioId2, {
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
    askerPortfolioId: string,
    bidderPortfolioId?: string
  ): {
    orders: Omit<OrderBookEntryDto, "timestamp">[];
    matchingOrder: Omit<OrderBookEntryDto, "timestamp">;
  } {
    const bidderPortfolio = bidderPortfolioId || askerPortfolioId;
    // Create orders at same price but different times (simulated by order)
    const orders = [
      this.createTestOrder(marketId, askerPortfolioId, {
        side: "ask",
        price: 50000,
        quantity: 1.0,
        orderId: "order-1", // First in time
      }),
      this.createTestOrder(marketId, askerPortfolioId, {
        side: "ask",
        price: 50000,
        quantity: 1.5,
        orderId: "order-2", // Second in time
      }),
    ];

    const matchingOrder = this.createTestOrder(marketId, bidderPortfolio, {
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
    bidderPortfolioId: string,
    orderCount: number = 100,
    askerPortfolioId?: string
  ): Omit<OrderBookEntryDto, "timestamp">[] {
    const askerPortfolio = askerPortfolioId || bidderPortfolioId;
    const orders: Omit<OrderBookEntryDto, "timestamp">[] = [];

    for (let i = 0; i < orderCount; i++) {
      const side = i % 2 === 0 ? "bid" : "ask";
      const basePrice = 50000;
      const priceVariation = (Math.random() - 0.5) * 1000; // ±500 price variation
      const price = Math.round((basePrice + priceVariation) * 100) / 100;
      const quantity = Math.round((Math.random() * 5 + 0.1) * 1000) / 1000;

      orders.push(
        this.createTestOrder(marketId, side === "bid" ? bidderPortfolioId : askerPortfolio, {
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
