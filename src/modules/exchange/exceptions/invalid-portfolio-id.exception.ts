import { HttpException, HttpStatus } from "@nestjs/common";

export class InvalidPortfolioIdException extends HttpException {
  constructor(portfolioId: string) {
    super(
      `Invalid portfolio ID format: ${portfolioId}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

