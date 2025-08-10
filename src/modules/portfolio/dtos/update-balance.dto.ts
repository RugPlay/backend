import { ApiProperty } from "@nestjs/swagger";

export class UpdateBalanceDto {
  @ApiProperty({
    description: "The new balance amount",
    example: 15000.5,
  })
  balance: number;
}
