import { INestApplication } from '@nestjs/common';
import { PortfolioDao } from '../../src/modules/portfolio/daos/portfolio.dao';
import { HoldingDao } from '../../src/modules/portfolio/daos/holding.dao';

export interface PortfolioState {
  portfolioId: string;
  startingBalance: number;
  startingHoldings: Record<string, number>; // marketId -> quantity
  expectedBalance: number;
  expectedHoldings: Record<string, number>; // marketId -> quantity
  reservedBalance: number; // Balance reserved for pending orders
  reservedHoldings: Record<string, number>; // marketId -> quantity reserved for pending ASK orders
}

export class PortfolioStateTracker {
  private portfolios: Map<string, PortfolioState> = new Map();

  /**
   * Register a portfolio with starting state
   */
  registerPortfolio(
    portfolioId: string,
    startingBalance: number,
    startingHoldings: Record<string, number> = {}
  ): void {
    this.portfolios.set(portfolioId, {
      portfolioId,
      startingBalance,
      startingHoldings: { ...startingHoldings },
      expectedBalance: startingBalance,
      expectedHoldings: { ...startingHoldings },
      reservedBalance: 0,
      reservedHoldings: {},
    });
  }

  /**
   * Register a portfolio by reading its current state from the database
   * This is useful when tests share portfolios and we need to start from the actual current state
   */
  async registerPortfolioFromCurrentState(
    app: INestApplication,
    portfolioId: string
  ): Promise<void> {
    const portfolioDao = app.get(PortfolioDao);
    const holdingDao = app.get(HoldingDao);

    const currentBalance = await portfolioDao.getBalanceByPortfolioId(portfolioId);
    if (currentBalance === null) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    const currentHoldings = await holdingDao.getHoldingsByPortfolioId(portfolioId);
    const holdingsMap: Record<string, number> = {};
    for (const holding of currentHoldings) {
      holdingsMap[holding.marketId] = parseFloat(holding.quantity.toString());
    }

    this.portfolios.set(portfolioId, {
      portfolioId,
      startingBalance: currentBalance,
      startingHoldings: { ...holdingsMap },
      expectedBalance: currentBalance,
      expectedHoldings: { ...holdingsMap },
      reservedBalance: 0,
      reservedHoldings: {},
    });
  }

  /**
   * Record a trade that affects portfolio state
   * @param portfolioId - Portfolio ID
   * @param marketId - Market ID
   * @param side - "bid" (buy) or "ask" (sell)
   * @param price - Trade price
   * @param quantity - Trade quantity
   * @param wasReserved - Whether the balance/holdings were already reserved (default: false)
   */
  recordTrade(
    portfolioId: string,
    marketId: string,
    side: 'bid' | 'ask',
    price: number,
    quantity: number,
    wasReserved: boolean = false
  ): void {
    const state = this.portfolios.get(portfolioId);
    if (!state) {
      throw new Error(`Portfolio ${portfolioId} not registered`);
    }

    if (side === 'bid') {
      // Buying: spend balance, gain holdings
      const cost = price * quantity;
      if (wasReserved) {
        // Balance was already reserved, just convert reservation to spent
        // The reserved balance is already subtracted from expectedBalance
        // So we don't need to subtract again, but we do need to release the reservation
        state.reservedBalance = Math.max(0, state.reservedBalance - cost);
      } else {
        // Balance wasn't reserved, subtract it now
        state.expectedBalance -= cost;
      }
      state.expectedHoldings[marketId] = (state.expectedHoldings[marketId] || 0) + quantity;
    } else {
      // Selling: gain balance, lose holdings
      const proceeds = price * quantity;
      state.expectedBalance += proceeds;
      
      if (wasReserved) {
        // Holdings were already deducted when order was placed
        // The quantity was already subtracted from the total when the order was placed
        // Now that it's sold, we reduce the reserved amount (since this portion is sold, not reserved)
        // But we also need to reduce the starting holdings to reflect the sale
        state.reservedHoldings[marketId] = Math.max(0, (state.reservedHoldings[marketId] || 0) - quantity);
        // Update starting holdings to reflect the sale (since it's permanently gone)
        state.startingHoldings[marketId] = (state.startingHoldings[marketId] || 0) - quantity;
        // Update expected holdings: starting (after sale) - reserved (for remaining unfilled orders)
        state.expectedHoldings[marketId] = state.startingHoldings[marketId] - (state.reservedHoldings[marketId] || 0);
      } else {
        // Holdings weren't reserved, subtract them now
        state.expectedHoldings[marketId] = (state.expectedHoldings[marketId] || 0) - quantity;
        // Update starting holdings to reflect the sale
        state.startingHoldings[marketId] = (state.startingHoldings[marketId] || 0) - quantity;
      }
      
      // Remove holding if quantity reaches zero or below
      const currentHolding = state.expectedHoldings[marketId] || 0;
      if (currentHolding <= 0 && !state.reservedHoldings[marketId]) {
        delete state.expectedHoldings[marketId];
      }
    }
  }

  /**
   * Reserve balance (for pending BID orders)
   * @param portfolioId - Portfolio ID
   * @param amount - Amount to reserve
   */
  reserveBalance(portfolioId: string, amount: number): void {
    const state = this.portfolios.get(portfolioId);
    if (!state) {
      throw new Error(`Portfolio ${portfolioId} not registered`);
    }
    // Reserved balance is subtracted from available balance
    state.expectedBalance -= amount;
    state.reservedBalance += amount;
  }

  /**
   * Reserve holdings (for pending ASK orders)
   * Note: When ASK orders are placed, holdings are DEDUCTED immediately from the database.
   * The database total = starting - all reserved quantities.
   * When orders are partially filled, the unfilled portion is restored (added back).
   * @param portfolioId - Portfolio ID
   * @param marketId - Market ID
   * @param quantity - Quantity to reserve (deducted from total immediately)
   */
  reserveHoldings(portfolioId: string, marketId: string, quantity: number): void {
    const state = this.portfolios.get(portfolioId);
    if (!state) {
      throw new Error(`Portfolio ${portfolioId} not registered`);
    }
    // Holdings are deducted immediately when ASK orders are placed
    // Track reserved quantity - this represents holdings locked in unfilled orders
    state.reservedHoldings[marketId] = (state.reservedHoldings[marketId] || 0) + quantity;
    // Expected total holdings = starting - reserved (for unfilled orders)
    // The expectedHoldings field represents the current available (not locked)
    const startingHolding = state.startingHoldings[marketId] || 0;
    state.expectedHoldings[marketId] = startingHolding - (state.reservedHoldings[marketId] || 0);
  }

  /**
   * Release reserved balance (when order is filled or cancelled)
   * @param portfolioId - Portfolio ID
   * @param amount - Amount to release
   */
  releaseBalance(portfolioId: string, amount: number): void {
    const state = this.portfolios.get(portfolioId);
    if (!state) {
      throw new Error(`Portfolio ${portfolioId} not registered`);
    }
    state.expectedBalance += amount;
  }

  /**
   * Get expected state for a portfolio
   */
  getExpectedState(portfolioId: string): PortfolioState | undefined {
    return this.portfolios.get(portfolioId);
  }

  /**
   * Verify portfolio balance matches expected
   */
  async verifyBalance(
    app: INestApplication,
    portfolioId: string,
    tolerance: number = 0.01
  ): Promise<{ success: boolean; expected: number; actual: number; difference: number }> {
    const state = this.portfolios.get(portfolioId);
    if (!state) {
      throw new Error(`Portfolio ${portfolioId} not registered`);
    }

    const portfolioDao = app.get(PortfolioDao);
    const actualBalance = await portfolioDao.getBalanceByPortfolioId(portfolioId);
    
    if (actualBalance === null) {
      return {
        success: false,
        expected: state.expectedBalance,
        actual: 0,
        difference: state.expectedBalance,
      };
    }

    const difference = Math.abs(actualBalance - state.expectedBalance);
    const success = difference <= tolerance;

    return {
      success,
      expected: state.expectedBalance,
      actual: actualBalance,
      difference,
    };
  }

  /**
   * Verify portfolio holdings match expected
   * Note: The database stores total holdings (available + reserved)
   * When orders are placed, holdings are reserved but not deducted from total
   * When orders are filled, holdings are deducted from total
   * When orders are partially filled, unfilled portion is restored (added back to total)
   * 
   * So expected total = starting - filled quantities
   */
  async verifyHoldings(
    app: INestApplication,
    portfolioId: string,
    marketId: string,
    tolerance: number = 0.0001
  ): Promise<{ success: boolean; expected: number; actual: number; difference: number }> {
    const state = this.portfolios.get(portfolioId);
    if (!state) {
      throw new Error(`Portfolio ${portfolioId} not registered`);
    }

    const holdingDao = app.get(HoldingDao);
    const holding = await holdingDao.getHolding(portfolioId, marketId);
    
    // Expected total holdings = starting - all filled quantities
    // This is calculated as: starting - (starting - current available - reserved)
    // Or more simply: available + reserved = total
    const expectedAvailableQuantity = state.expectedHoldings[marketId] || 0;
    const reservedQuantity = state.reservedHoldings[marketId] || 0;
    const expectedTotalQuantity = expectedAvailableQuantity + reservedQuantity;
    
    const actualQuantity = holding ? parseFloat(holding.quantity.toString()) : 0;
    
    // Compare total holdings (available + reserved) with actual
    const difference = Math.abs(actualQuantity - expectedTotalQuantity);
    const success = difference <= tolerance;

    return {
      success,
      expected: expectedTotalQuantity, // Return total expected (available + reserved) for comparison
      actual: actualQuantity,
      difference,
    };
  }

  /**
   * Verify all holdings for a portfolio
   */
  async verifyAllHoldings(
    app: INestApplication,
    portfolioId: string,
    tolerance: number = 0.0001
  ): Promise<Map<string, { success: boolean; expected: number; actual: number; difference: number }>> {
    const state = this.portfolios.get(portfolioId);
    if (!state) {
      throw new Error(`Portfolio ${portfolioId} not registered`);
    }

    const results = new Map<string, { success: boolean; expected: number; actual: number; difference: number }>();
    
    // Check all expected holdings
    for (const [marketId, expectedQuantity] of Object.entries(state.expectedHoldings)) {
      const result = await this.verifyHoldings(app, portfolioId, marketId, tolerance);
      results.set(marketId, result);
    }

    // Check for holdings that exist but shouldn't
    const holdingDao = app.get(HoldingDao);
    const allHoldings = await holdingDao.getHoldingsByPortfolioId(portfolioId);
    
    for (const holding of allHoldings) {
      const marketId = holding.marketId;
      if (!state.expectedHoldings[marketId] || state.expectedHoldings[marketId] <= 0) {
        const actualQuantity = parseFloat(holding.quantity.toString());
        if (actualQuantity > tolerance) {
          results.set(marketId, {
            success: false,
            expected: 0,
            actual: actualQuantity,
            difference: actualQuantity,
          });
        }
      }
    }

    return results;
  }

  /**
   * Verify complete portfolio state (balance + all holdings)
   */
  async verifyPortfolio(
    app: INestApplication,
    portfolioId: string,
    balanceTolerance: number = 0.01,
    holdingTolerance: number = 0.0001
  ): Promise<{
    portfolioId: string;
    balance: { success: boolean; expected: number; actual: number; difference: number };
    holdings: Map<string, { success: boolean; expected: number; actual: number; difference: number }>;
    allSuccess: boolean;
  }> {
    const balance = await this.verifyBalance(app, portfolioId, balanceTolerance);
    const holdings = await this.verifyAllHoldings(app, portfolioId, holdingTolerance);
    
    const allHoldingsSuccess = Array.from(holdings.values()).every(h => h.success);
    const allSuccess = balance.success && allHoldingsSuccess;

    return {
      portfolioId,
      balance,
      holdings,
      allSuccess,
    };
  }

  /**
   * Reset tracker (clear all registered portfolios)
   */
  reset(): void {
    this.portfolios.clear();
  }
}

