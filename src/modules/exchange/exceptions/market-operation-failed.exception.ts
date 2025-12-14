import { HttpException, HttpStatus } from "@nestjs/common";

export class MarketOperationFailedException extends HttpException {
  constructor(operation: string, message?: string) {
    super(
      message || `Failed to ${operation} market`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

