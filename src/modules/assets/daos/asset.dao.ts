import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { CreateAssetDto } from "../dtos/create-asset.dto";
import { UpdateAssetDto } from "../dtos/update-asset.dto";
import { AssetFiltersDto } from "../dtos/asset-filters.dto";
import { AssetDto } from "../dtos/asset.dto";

@Injectable()
export class AssetDao extends KyselyDao<AssetDao> {
  /**
   * Insert a new asset into the database
   */
  async createAsset(asset: CreateAssetDto): Promise<string | null> {
    try {
      const result = await this.kysely
        .insertInto('assets')
        .values({
          symbol: asset.symbol,
          name: asset.name,
          type: asset.type,
          decimals: asset.decimals || 8,
          is_active: asset.isActive ?? true,
        } as any)
        .returning('id')
        .executeTakeFirst();

      return result?.id || null;
    } catch (error) {
      console.error("Error creating asset:", error);
      return null;
    }
  }

  /**
   * Get an asset by ID
   */
  async getAssetById(id: string): Promise<AssetDto | null> {
    try {
      const result = await this.kysely
        .selectFrom('assets')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return result ? this.mapRecordToDto(result) : null;
    } catch (error) {
      console.error("Error fetching asset by ID:", error);
      return null;
    }
  }

  /**
   * Get an asset by symbol
   */
  async getAssetBySymbol(symbol: string): Promise<AssetDto | null> {
    try {
      const result = await this.kysely
        .selectFrom('assets')
        .selectAll()
        .where('symbol', '=', symbol)
        .executeTakeFirst();
      return result ? this.mapRecordToDto(result) : null;
    } catch (error) {
      console.error("Error fetching asset by symbol:", error);
      return null;
    }
  }

  /**
   * Get all assets with optional filters
   */
  async getAssets(filters?: AssetFiltersDto): Promise<AssetDto[]> {
    try {
      let query = this.kysely
        .selectFrom('assets')
        .selectAll();

      if (filters?.type) {
        query = query.where('type', '=', filters.type);
      }

      if (filters?.isActive !== undefined) {
        query = query.where('is_active', '=', filters.isActive);
      }

      if (filters?.symbol) {
        query = query.where('symbol', '=', filters.symbol);
      }

      const results = await query.orderBy('symbol', 'asc').execute();
      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching assets:", error);
      return [];
    }
  }

  /**
   * Get all active assets
   */
  async getActiveAssets(): Promise<AssetDto[]> {
    try {
      const results = await this.kysely
        .selectFrom('assets')
        .selectAll()
        .where('is_active', '=', true)
        .orderBy('symbol', 'asc')
        .execute();
      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching active assets:", error);
      return [];
    }
  }

  /**
   * Update an asset
   */
  async updateAsset(id: string, asset: UpdateAssetDto): Promise<boolean> {
    try {
      const updateData: any = {};

      if (asset.symbol !== undefined) updateData.symbol = asset.symbol;
      if (asset.name !== undefined) updateData.name = asset.name;
      if (asset.type !== undefined) updateData.type = asset.type;
      if (asset.decimals !== undefined) updateData.decimals = asset.decimals;
      if (asset.isActive !== undefined) updateData.is_active = asset.isActive;

      updateData.updated_at = new Date();

      const result = await this.kysely
        .updateTable('assets')
        .set(updateData)
        .where('id', '=', id)
        .executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error updating asset:", error);
      return false;
    }
  }

  /**
   * Delete an asset by ID
   */
  async deleteAsset(id: string): Promise<boolean> {
    try {
      const result = await this.kysely
        .deleteFrom('assets')
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numDeletedRows > 0;
    } catch (error) {
      console.error("Error deleting asset:", error);
      return false;
    }
  }

  /**
   * Get all unique asset types
   */
  async getAssetTypes(): Promise<string[]> {
    try {
      const results = await this.kysely
        .selectFrom('assets')
        .select('type')
        .distinct()
        .execute();
      return results.map(row => row.type);
    } catch (error) {
      console.error("Error fetching asset types:", error);
      return [];
    }
  }

  /**
   * Map database record to AssetDto
   */
  private mapRecordToDto(record: any): AssetDto {
    const dto = new AssetDto();
    dto.id = record.id;
    dto.symbol = record.symbol;
    dto.name = record.name;
    dto.type = record.type;
    dto.decimals = record.decimals;
    dto.isActive = record.is_active;
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    return dto;
  }
}

