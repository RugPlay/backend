import { HttpException, HttpStatus } from "@nestjs/common";

export class OrderCreationFailedException extends HttpException {
  constructor(message: string = "Failed to save order to database") {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

