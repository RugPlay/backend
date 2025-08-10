import { TradeExecutionDto } from "../../dtos/trade/trade-execution.dto";

export class TradeExecutionEvent {
  readonly eventType = "TRADE_EXECUTION" as const;
  readonly timestamp: Date;

  constructor(readonly trade: TradeExecutionDto) {
    this.timestamp = new Date();
  }
}
