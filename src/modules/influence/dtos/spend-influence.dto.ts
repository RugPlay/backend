import { ApiProperty } from "@nestjs/swagger";
import { IsUUID, IsNotEmpty, IsNumber, Min } from "class-validator";
import { Type } from "class-transformer";

export class SpendInfluenceDto {
  @ApiProperty({
    description: "The corporation ID spending influence",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID(4, { message: "Corporation ID must be a valid UUID" })
  @IsNotEmpty({ message: "Corporation ID is required" })
  corporationId: string;

  @ApiProperty({
    description: "Amount of influence to spend",
    example: 5.0,
    minimum: 0.01,
  })
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 8 },
    { message: "Amount must be a valid number" }
  )
  @Min(0.01, { message: "Amount must be greater than 0" })
  @Type(() => Number)
  amount: number;
}

