import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, IsEnum, IsDateString } from 'class-validator';

/**
 * DTO for batch trade creation
 */
export class BatchCreateTradeDto {
  @ApiProperty({
    description: 'Unique trade identifier',
    example: 'trade-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  readonly tradeId: string;

  @ApiProperty({
    description: 'Market identifier',
    example: 'market-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  readonly marketId: string;

  @ApiProperty({
    description: 'Taker order identifier',
    example: 'order-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  readonly takerOrderId: string;

  @ApiProperty({
    description: 'Maker order identifier',
    example: 'order-456e7890-e89b-12d3-a456-426614174000',
  })
  @IsString()
  readonly makerOrderId: string;

  @ApiProperty({
    description: 'Side of the taker order',
    enum: ['bid', 'ask'],
    example: 'bid',
  })
  @IsEnum(['bid', 'ask'])
  readonly takerSide: 'bid' | 'ask';

  @ApiProperty({
    description: 'Quantity traded',
    example: 100.5,
    minimum: 0.000001,
  })
  @IsNumber()
  @IsPositive()
  readonly quantity: number;

  @ApiProperty({
    description: 'Price at which the trade occurred',
    example: 50.25,
    minimum: 0.000001,
  })
  @IsNumber()
  @IsPositive()
  readonly price: number;

  @ApiProperty({
    description: 'Timestamp of the trade',
    example: '2023-01-01T12:00:00.000Z',
  })
  @IsDateString()
  readonly timestamp: Date;
}

/**
 * DTO for batch trade creation response
 */
export class BatchTradeOperationResultDto {
  @ApiProperty({
    description: 'Number of trades successfully created',
    example: 5,
  })
  readonly tradesCreated: number;

  @ApiProperty({
    description: 'List of created trade IDs',
    type: [String],
    example: ['trade-1', 'trade-2', 'trade-3'],
  })
  readonly createdTradeIds: string[];
}
