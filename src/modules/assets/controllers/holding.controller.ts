import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { HoldingService } from "../services/holding.service";
import { HoldingDto } from "../dtos/holding.dto";
import { CreateHoldingDto } from "../dtos/create-holding.dto";
import { UpdateHoldingDto } from "../dtos/update-holding.dto";

@ApiTags("holdings")
@Controller("holdings")
export class HoldingController {
  constructor(private readonly holdingService: HoldingService) {}

  @Get("corporation/:corporationId")
  @ApiOperation({ summary: "Get all holdings for a corporation" })
  @ApiParam({ name: "corporationId", description: "Corporation ID" })
  @ApiResponse({
    status: 200,
    description: "List of holdings",
    type: [HoldingDto],
  })
  async getHoldingsByCorporationId(@Param("corporationId") corporationId: string): Promise<HoldingDto[]> {
    return await this.holdingService.getHoldingsByCorporationId(corporationId);
  }

  @Get("corporation/:corporationId/asset/:assetId")
  @ApiOperation({ summary: "Get a specific holding by corporation ID and asset ID" })
  @ApiParam({ name: "corporationId", description: "Corporation ID" })
  @ApiParam({ name: "assetId", description: "Asset ID" })
  @ApiResponse({
    status: 200,
    description: "Holding details",
    type: HoldingDto,
  })
  @ApiResponse({ status: 404, description: "Holding not found" })
  async getHolding(
    @Param("corporationId") corporationId: string,
    @Param("assetId") assetId: string,
  ): Promise<HoldingDto> {
    const holding = await this.holdingService.getHolding(corporationId, assetId);
    if (!holding) {
      throw new NotFoundException(`Holding not found for corporation ${corporationId} and asset ${assetId}`);
    }
    return holding;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create or update a holding" })
  @ApiResponse({
    status: 201,
    description: "Holding created or updated successfully",
  })
  async upsertHolding(@Body() createHoldingDto: CreateHoldingDto): Promise<{ success: boolean }> {
    const success = await this.holdingService.upsertHolding(
      createHoldingDto.corporationId,
      createHoldingDto.assetId,
      createHoldingDto.quantity,
    );
    return { success };
  }

  @Put("corporation/:corporationId/asset/:assetId/quantity")
  @ApiOperation({ summary: "Set holding quantity to a specific value" })
  @ApiParam({ name: "corporationId", description: "Corporation ID" })
  @ApiParam({ name: "assetId", description: "Asset ID" })
  @ApiResponse({
    status: 200,
    description: "Holding quantity updated successfully",
  })
  async setHoldingQuantity(
    @Param("corporationId") corporationId: string,
    @Param("assetId") assetId: string,
    @Body() updateDto: { quantity: number },
  ): Promise<{ success: boolean }> {
    const success = await this.holdingService.setHoldingQuantity(
      corporationId,
      assetId,
      updateDto.quantity,
    );
    return { success };
  }

  @Put("corporation/:corporationId/asset/:assetId/adjust")
  @ApiOperation({ summary: "Adjust holding quantity by a delta amount" })
  @ApiParam({ name: "corporationId", description: "Corporation ID" })
  @ApiParam({ name: "assetId", description: "Asset ID" })
  @ApiResponse({
    status: 200,
    description: "Holding quantity adjusted successfully",
  })
  async adjustHoldingQuantity(
    @Param("corporationId") corporationId: string,
    @Param("assetId") assetId: string,
    @Body() updateDto: { deltaQuantity: number },
  ): Promise<{ success: boolean }> {
    const success = await this.holdingService.adjustHoldingQuantity(
      corporationId,
      assetId,
      updateDto.deltaQuantity,
    );
    return { success };
  }
}

