import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { InfluenceService } from "../services/influence.service";
import { PurchaseInfluenceDto } from "../dtos/purchase-influence.dto";
import { SpendInfluenceDto } from "../dtos/spend-influence.dto";
import { InfluenceBalanceDto } from "../dtos/influence-balance.dto";

@Controller("influence")
@ApiTags("Influence")
export class InfluenceController {
  constructor(private readonly influenceService: InfluenceService) {}

  @Post("purchase")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Purchase influence using USD" })
  @ApiResponse({
    status: 200,
    description: "Influence purchased successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        newBalance: { type: "number" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Bad request (insufficient funds, invalid amount)" })
  @ApiResponse({ status: 404, description: "Corporation or USD asset not found" })
  async purchaseInfluence(@Body() dto: PurchaseInfluenceDto) {
    return this.influenceService.purchaseInfluence(dto.corporationId, dto.amount);
  }

  @Get("balance/:corporationId")
  @ApiOperation({ summary: "Get current influence balance (calculated on-the-fly)" })
  @ApiResponse({
    status: 200,
    description: "Influence balance retrieved successfully",
    type: InfluenceBalanceDto,
  })
  @ApiResponse({ status: 404, description: "Corporation not found" })
  async getBalance(@Param("corporationId") corporationId: string): Promise<InfluenceBalanceDto> {
    const balance = await this.influenceService.getInfluenceBalance(corporationId);
    return { corporationId, balance };
  }

  @Post("spend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Spend influence (for upgrades, etc.)" })
  @ApiResponse({
    status: 200,
    description: "Influence spent successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        newBalance: { type: "number" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Bad request (insufficient influence)" })
  @ApiResponse({ status: 404, description: "Corporation not found" })
  async spendInfluence(@Body() dto: SpendInfluenceDto) {
    return this.influenceService.spendInfluence(dto.corporationId, dto.amount);
  }
}

