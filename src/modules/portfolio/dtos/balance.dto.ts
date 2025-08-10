import { ApiProperty } from "@nestjs/swagger";

export class BalanceDto {
  @ApiProperty({
    description: "The user ID",
    example: "user_123e4567-e89b-12d3-a456-426614174000",
  })
  userId: string;

  @ApiProperty({
    description: "The current balance",
    example: 10000.5,
  })
  balance: number;

  @ApiProperty({
    description: "The timestamp when the balance was last updated",
    example: "2024-03-20T12:00:00Z",
  })
  updatedAt: Date;
}
