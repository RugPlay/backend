import { ApiProperty } from "@nestjs/swagger";
import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsUUID,
  IsNotEmpty,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class PlaceOrderDto {
  @ApiProperty({
    description: "Order side (bid for buy, ask for sell)",
    enum: ["bid", "ask"],
    example: "bid",
  })
  @IsEnum(["bid", "ask"], {
    message: "Side must be either 'bid' or 'ask'",
  })
  @IsNotEmpty({ message: "Side is required" })
  side: "bid" | "ask";

  @ApiProperty({
    description: "Order price",
    example: 50000.5,
    minimum: 0.01,
  })
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 8 },
    { message: "Price must be a valid number" },
  )
  @IsPositive({ message: "Price must be a positive number" })
  @Type(() => Number)
  price: number;

  @ApiProperty({
    description: "Order quantity",
    example: 1.5,
    minimum: 0.001,
  })
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 8 },
    { message: "Quantity must be a valid number" },
  )
  @Min(0.001, { message: "Quantity must be greater than 0" })
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    description: "The unique identifier of the portfolio placing the order",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID(4, { message: "Portfolio ID must be a valid UUID" })
  @IsNotEmpty({ message: "Portfolio ID is required" })
  portfolioId: string;
}

