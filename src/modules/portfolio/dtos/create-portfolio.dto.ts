import { ApiProperty } from "@nestjs/swagger";

export class CreatePortfolioDto {
  @ApiProperty({
    description: "Initial balance for the portfolio",
    example: 10000.0,
    required: false,
    default: 0,
  })
  balance?: number = 0;
}
