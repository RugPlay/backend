import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsNotEmpty, Min } from "class-validator";

/**
 * DTO for adding production time to a business
 */
export class AddProductionTimeDto {
  @ApiProperty({
    description: "Time to add in seconds",
    example: 3600,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  timeSeconds: number;
}

