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

  @Get("user/:userId")
  @ApiOperation({ summary: "Get all holdings for a user" })
  @ApiParam({ name: "userId", description: "User ID" })
  @ApiResponse({
    status: 200,
    description: "List of holdings",
    type: [HoldingDto],
  })
  async getHoldingsByUserId(@Param("userId") userId: string): Promise<HoldingDto[]> {
    return await this.holdingService.getHoldingsByUserId(userId);
  }

  @Get("user/:userId/asset/:assetId")
  @ApiOperation({ summary: "Get a specific holding by user ID and asset ID" })
  @ApiParam({ name: "userId", description: "User ID" })
  @ApiParam({ name: "assetId", description: "Asset ID" })
  @ApiResponse({
    status: 200,
    description: "Holding details",
    type: HoldingDto,
  })
  @ApiResponse({ status: 404, description: "Holding not found" })
  async getHolding(
    @Param("userId") userId: string,
    @Param("assetId") assetId: string,
  ): Promise<HoldingDto> {
    const holding = await this.holdingService.getHolding(userId, assetId);
    if (!holding) {
      throw new NotFoundException(`Holding not found for user ${userId} and asset ${assetId}`);
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
      createHoldingDto.userId,
      createHoldingDto.assetId,
      createHoldingDto.quantity,
    );
    return { success };
  }

  @Put("user/:userId/asset/:assetId/quantity")
  @ApiOperation({ summary: "Set holding quantity to a specific value" })
  @ApiParam({ name: "userId", description: "User ID" })
  @ApiParam({ name: "assetId", description: "Asset ID" })
  @ApiResponse({
    status: 200,
    description: "Holding quantity updated successfully",
  })
  async setHoldingQuantity(
    @Param("userId") userId: string,
    @Param("assetId") assetId: string,
    @Body() updateDto: { quantity: number },
  ): Promise<{ success: boolean }> {
    const success = await this.holdingService.setHoldingQuantity(
      userId,
      assetId,
      updateDto.quantity,
    );
    return { success };
  }

  @Put("user/:userId/asset/:assetId/adjust")
  @ApiOperation({ summary: "Adjust holding quantity by a delta amount" })
  @ApiParam({ name: "userId", description: "User ID" })
  @ApiParam({ name: "assetId", description: "Asset ID" })
  @ApiResponse({
    status: 200,
    description: "Holding quantity adjusted successfully",
  })
  async adjustHoldingQuantity(
    @Param("userId") userId: string,
    @Param("assetId") assetId: string,
    @Body() updateDto: { deltaQuantity: number },
  ): Promise<{ success: boolean }> {
    const success = await this.holdingService.adjustHoldingQuantity(
      userId,
      assetId,
      updateDto.deltaQuantity,
    );
    return { success };
  }
}

