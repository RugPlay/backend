import { ApiProperty } from "@nestjs/swagger";
import { HoldingDto } from "./holding.dto";
import { PortfolioType } from "../types/portfolio-type";

export class PortfolioDto {
  @ApiProperty({
    description: "The unique identifier of the portfolio",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "The user ID who owns this portfolio",
    example: "user_123e4567-e89b-12d3-a456-426614174000",
  })
  userId: string;

  @ApiProperty({
    description: "The current dollar balance in the portfolio",
    example: 10000.5,
  })
  balance: number;

  @ApiProperty({
    description: "The type of portfolio (only real money trading supported)",
    enum: ["real"],
    example: "real",
  })
  type: PortfolioType;

  @ApiProperty({
    description: "Array of asset holdings in the portfolio",
    type: [HoldingDto],
  })
  holdings: HoldingDto[];

  @ApiProperty({
    description: "The timestamp when the portfolio was created",
    example: "2024-03-20T12:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "The timestamp when the portfolio was last updated",
    example: "2024-03-20T12:00:00Z",
  })
  updatedAt: Date;
}
