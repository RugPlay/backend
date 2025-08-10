export class OrderFillEvent {
  readonly eventType = "ORDER_FILL" as const;
  readonly timestamp: Date;

  constructor(
    readonly orderId: string,
    readonly marketId: string,
    readonly side: "bid" | "ask",
    readonly filledQuantity: number,
    readonly remainingQuantity: number,
    readonly fillPrice: number,
    readonly isComplete: boolean,
  ) {
    this.timestamp = new Date();
  }
}
