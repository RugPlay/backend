import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, ValidateNested, IsUUID, IsNumber, Min } from "class-validator";
import { Type } from "class-transformer";

export class ProductionInputItemDto {
  @ApiProperty({
    description: "The ID of the asset/resource to add as input",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  assetId: string;

  @ApiProperty({
    description: "The quantity of the asset to add",
    example: 4,
  })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  quantity: number;
}

/**
 * DTO for adding production inputs to start a production cycle
 */
export class AddProductionInputsDto {
  @ApiProperty({
    description: "List of inputs to add for production",
    type: [ProductionInputItemDto],
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProductionInputItemDto)
  inputs: ProductionInputItemDto[];
}

