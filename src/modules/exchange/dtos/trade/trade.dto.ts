import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TradeType } from "../../types/trade-type";

export class TradeDto {
  @ApiProperty({
    description: "The unique identifier of the trade record",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "The unique identifier of the trade execution",
    example: "trade_123e4567-e89b-12d3-a456-426614174000",
  })
  tradeId: string;

  @ApiProperty({
    description: "The unique identifier of the market where the trade occurred",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  marketId: string;

  @ApiProperty({
    description: "The order ID of the taker (incoming order that triggered the match)",
    example: "ord_123e4567-e89b-12d3-a456-426614174000",
  })
  takerOrderId: string;

  @ApiProperty({
    description: "The order ID of the maker (existing order that was matched)",
    example: "ord_456e7890-e89b-12d3-a456-426614174001",
  })
  makerOrderId: string;

  @ApiProperty({
    description: "The side of the taker order (bid for buy, ask for sell)",
    example: "bid",
    enum: ["bid", "ask"],
  })
  takerSide: "bid" | "ask";

  @ApiProperty({
    description: "The type of trade (paper or real)",
    example: "real",
    enum: ["paper", "real"],
  })
  type: TradeType;

  @ApiProperty({
    description: "The quantity that was traded",
    example: 1.5,
  })
  quantity: number;

  @ApiProperty({
    description: "The price at which the trade was executed",
    example: 50000.5,
  })
  price: number;

  @ApiPropertyOptional({
    description: "The user ID of the taker",
    example: "user_123e4567-e89b-12d3-a456-426614174000",
  })
  takerUserId?: string;

  @ApiPropertyOptional({
    description: "The user ID of the maker",
    example: "user_456e7890-e89b-12d3-a456-426614174001",
  })
  makerUserId?: string;

  @ApiProperty({
    description: "The timestamp when the trade was created",
    example: "2024-03-20T12:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "The timestamp when the trade was last updated",
    example: "2024-03-20T12:00:00Z",
  })
  updatedAt: Date;
}
