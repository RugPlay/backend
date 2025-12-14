import { HttpException, HttpStatus } from "@nestjs/common";

export class MarketNotFoundException extends HttpException {
  constructor(marketId: string) {
    super(`Market ${marketId} not found`, HttpStatus.NOT_FOUND);
  }
}

