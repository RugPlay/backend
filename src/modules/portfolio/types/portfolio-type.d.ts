export type PortfolioType = "paper" | "real";

/**
 * Available portfolio types
 */
export const PORTFOLIO_TYPES = {
  PAPER: "paper" as const,
  REAL: "real" as const,
} as const;
