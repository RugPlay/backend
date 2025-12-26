import { ApiProperty } from "@nestjs/swagger";

export class InfluenceBalanceDto {
  @ApiProperty({
    description: "The corporation ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  corporationId: string;

  @ApiProperty({
    description: "Current influence balance (calculated on-the-fly)",
    example: 100.5,
  })
  balance: number;
}

