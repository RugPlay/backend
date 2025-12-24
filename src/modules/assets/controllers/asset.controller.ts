import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { AssetService } from "../services/asset.service";
import { UpdateAssetDto } from "../dtos/update-asset.dto";
import { AssetFiltersDto } from "../dtos/asset-filters.dto";
import { AssetDto } from "../dtos/asset.dto";

@ApiTags("Assets")
@Controller("assets")
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  @ApiOperation({ summary: "Get all assets with optional filters" })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "isActive", required: false })
  @ApiQuery({ name: "symbol", required: false })
  @ApiResponse({
    status: 200,
    description: "List of assets",
    type: [AssetDto],
  })
  async getAssets(
    @Query() filters: AssetFiltersDto
  ): Promise<AssetDto[]> {
    return this.assetService.getAssets(filters);
  }

  @Get("active")
  @ApiOperation({ summary: "Get all active assets" })
  @ApiResponse({
    status: 200,
    description: "List of active assets",
    type: [AssetDto],
  })
  async getActiveAssets(): Promise<AssetDto[]> {
    return this.assetService.getActiveAssets();
  }

  @Get("types")
  @ApiOperation({ summary: "Get all unique asset types" })
  @ApiResponse({
    status: 200,
    description: "List of asset types",
    type: [String],
  })
  async getAssetTypes(): Promise<string[]> {
    return this.assetService.getAssetTypes();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an asset by ID" })
  @ApiParam({ name: "id", description: "Asset ID" })
  @ApiResponse({
    status: 200,
    description: "Asset found",
    type: AssetDto,
  })
  @ApiResponse({ status: 404, description: "Asset not found" })
  async getAssetById(@Param("id") id: string): Promise<AssetDto> {
    return this.assetService.getAssetById(id);
  }

  @Get("symbol/:symbol")
  @ApiOperation({ summary: "Get an asset by symbol" })
  @ApiParam({ name: "symbol", description: "Asset symbol" })
  @ApiResponse({
    status: 200,
    description: "Asset found",
    type: AssetDto,
  })
  @ApiResponse({ status: 404, description: "Asset not found" })
  async getAssetBySymbol(@Param("symbol") symbol: string): Promise<AssetDto> {
    return this.assetService.getAssetBySymbol(symbol);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update an asset" })
  @ApiParam({ name: "id", description: "Asset ID" })
  @ApiResponse({
    status: 200,
    description: "Asset updated successfully",
    type: AssetDto,
  })
  @ApiResponse({ status: 404, description: "Asset not found" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async updateAsset(
    @Param("id") id: string,
    @Body() updateDto: UpdateAssetDto
  ): Promise<AssetDto> {
    return this.assetService.updateAsset(id, updateDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an asset" })
  @ApiParam({ name: "id", description: "Asset ID" })
  @ApiResponse({
    status: 204,
    description: "Asset deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Asset not found" })
  async deleteAsset(@Param("id") id: string): Promise<void> {
    return this.assetService.deleteAsset(id);
  }
}

