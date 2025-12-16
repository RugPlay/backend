import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { AssetDao } from "../daos/asset.dao";
import { CreateAssetDto } from "../dtos/create-asset.dto";
import { UpdateAssetDto } from "../dtos/update-asset.dto";
import { AssetFiltersDto } from "../dtos/asset-filters.dto";
import { AssetDto } from "../dtos/asset.dto";

@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  constructor(private readonly assetDao: AssetDao) {}

  /**
   * Create a new asset
   */
  async createAsset(createDto: CreateAssetDto): Promise<AssetDto> {
    this.logger.log(`Creating asset: ${createDto.symbol}`);

    // Check if asset with same symbol already exists
    const existing = await this.assetDao.getAssetBySymbol(createDto.symbol);
    if (existing) {
      throw new BadRequestException(
        `Asset with symbol ${createDto.symbol} already exists`
      );
    }

    const assetId = await this.assetDao.createAsset(createDto);
    if (!assetId) {
      throw new BadRequestException("Failed to create asset");
    }

    const asset = await this.assetDao.getAssetById(assetId);
    if (!asset) {
      throw new NotFoundException("Asset not found after creation");
    }

    return asset;
  }

  /**
   * Get an asset by ID
   */
  async getAssetById(id: string): Promise<AssetDto> {
    const asset = await this.assetDao.getAssetById(id);
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }
    return asset;
  }

  /**
   * Get an asset by symbol
   */
  async getAssetBySymbol(symbol: string): Promise<AssetDto> {
    const asset = await this.assetDao.getAssetBySymbol(symbol);
    if (!asset) {
      throw new NotFoundException(`Asset with symbol ${symbol} not found`);
    }
    return asset;
  }

  /**
   * Get all assets with optional filters
   */
  async getAssets(filters?: AssetFiltersDto): Promise<AssetDto[]> {
    return this.assetDao.getAssets(filters);
  }

  /**
   * Get all active assets
   */
  async getActiveAssets(): Promise<AssetDto[]> {
    return this.assetDao.getActiveAssets();
  }

  /**
   * Update an asset
   */
  async updateAsset(id: string, updateDto: UpdateAssetDto): Promise<AssetDto> {
    this.logger.log(`Updating asset: ${id}`);

    // Check if asset exists
    const existing = await this.assetDao.getAssetById(id);
    if (!existing) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }

    // If updating symbol, check for conflicts
    if (updateDto.symbol && updateDto.symbol !== existing.symbol) {
      const symbolConflict = await this.assetDao.getAssetBySymbol(updateDto.symbol);
      if (symbolConflict && symbolConflict.id !== id) {
        throw new BadRequestException(
          `Asset with symbol ${updateDto.symbol} already exists`
        );
      }
    }

    const success = await this.assetDao.updateAsset(id, updateDto);
    if (!success) {
      throw new BadRequestException("Failed to update asset");
    }

    const updated = await this.assetDao.getAssetById(id);
    if (!updated) {
      throw new NotFoundException("Asset not found after update");
    }

    return updated;
  }

  /**
   * Delete an asset
   */
  async deleteAsset(id: string): Promise<void> {
    this.logger.log(`Deleting asset: ${id}`);

    const existing = await this.assetDao.getAssetById(id);
    if (!existing) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }

    const success = await this.assetDao.deleteAsset(id);
    if (!success) {
      throw new BadRequestException("Failed to delete asset");
    }
  }

  /**
   * Get all unique asset types
   */
  async getAssetTypes(): Promise<string[]> {
    return this.assetDao.getAssetTypes();
  }
}

