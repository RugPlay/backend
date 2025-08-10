/**
 * Trade type enum - specifies whether a trade is paper trading or real trading
 */
export type TradeType = "paper" | "real";

/**
 * Available trade types
 */
export const TRADE_TYPES = {
  PAPER: "paper" as const,
  REAL: "real" as const,
} as const;
