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
    description: "The user ID placing the order",
    example: "user_123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty({ message: "User ID is required" })
  userId: string;

  @ApiProperty({
    description: "The quote asset ID for the order",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID(4, { message: "Quote asset ID must be a valid UUID" })
  @IsNotEmpty({ message: "Quote asset ID is required" })
  quoteAssetId: string;
}

