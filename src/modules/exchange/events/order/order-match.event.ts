import { MatchResultDto } from "../../dtos/order/match-result.dto";

export class OrderMatchEvent {
  readonly eventType = "ORDER_MATCH" as const;
  readonly timestamp: Date;

  constructor(readonly match: MatchResultDto) {
    this.timestamp = new Date();
  }
}
