import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";

export class CancelOrderDto {
  @ApiProperty({
    description: "Order side (required for efficient cancellation)",
    enum: ["bid", "ask"],
    example: "bid",
  })
  @IsEnum(["bid", "ask"], {
    message: "Side must be either 'bid' or 'ask'",
  })
  @IsNotEmpty({ message: "Side is required" })
  side: "bid" | "ask";
}

