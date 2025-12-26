import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { CreateCorporationDto } from "../dtos/create-corporation.dto";
import { UpdateCorporationDto } from "../dtos/update-corporation.dto";
import { CorporationFiltersDto } from "../dtos/corporation-filters.dto";
import { CorporationDto } from "../dtos/corporation.dto";
import { sql } from "kysely";

@Injectable()
export class CorporationDao extends KyselyDao<CorporationDao> {
  /**
   * Insert a new corporation into the database
   */
  async createCorporation(
    corporation: CreateCorporationDto
  ): Promise<string | null> {
    try {
      const result = await this.kysely
        .insertInto("corporations")
        .values({
          name: corporation.name,
          description: corporation.description,
          industry: corporation.industry,
          is_active: corporation.isActive ?? true,
        } as any)
        .returning("id")
        .executeTakeFirst();

      return result?.id || null;
    } catch (error) {
      console.error("Error creating corporation:", error);
      return null;
    }
  }

  /**
   * Get a corporation by ID
   */
  async getCorporationById(id: string): Promise<CorporationDto | null> {
    try {
      const result = await this.kysely
        .selectFrom("corporations")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return result ? this.mapRecordToDto(result) : null;
    } catch (error) {
      console.error("Error fetching corporation by ID:", error);
      return null;
    }
  }

  /**
   * Get a corporation by name
   */
  async getCorporationByName(name: string): Promise<CorporationDto | null> {
    try {
      const result = await this.kysely
        .selectFrom("corporations")
        .selectAll()
        .where("name", "=", name)
        .executeTakeFirst();
      return result ? this.mapRecordToDto(result) : null;
    } catch (error) {
      console.error("Error fetching corporation by name:", error);
      return null;
    }
  }

  /**
   * Get all corporations with optional filters
   */
  async getCorporations(
    filters?: CorporationFiltersDto
  ): Promise<CorporationDto[]> {
    try {
      let query = this.kysely.selectFrom("corporations").selectAll();

      if (filters?.industry) {
        query = query.where("industry", "=", filters.industry);
      }

      if (filters?.isActive !== undefined) {
        query = query.where("is_active", "=", filters.isActive);
      }

      if (filters?.name) {
        query = query.where("name", "ilike", `%${filters.name}%`);
      }

      const results = await query.orderBy("name", "asc").execute();
      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching corporations:", error);
      return [];
    }
  }

  /**
   * Get all active corporations
   */
  async getActiveCorporations(): Promise<CorporationDto[]> {
    try {
      const results = await this.kysely
        .selectFrom("corporations")
        .selectAll()
        .where("is_active", "=", true)
        .orderBy("name", "asc")
        .execute();
      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching active corporations:", error);
      return [];
    }
  }

  /**
   * Update a corporation
   */
  async updateCorporation(
    id: string,
    corporation: UpdateCorporationDto
  ): Promise<boolean> {
    try {
      const updateData: any = {};

      if (corporation.name !== undefined) updateData.name = corporation.name;
      if (corporation.description !== undefined)
        updateData.description = corporation.description;
      if (corporation.industry !== undefined)
        updateData.industry = corporation.industry;
      if (corporation.isActive !== undefined)
        updateData.is_active = corporation.isActive;

      updateData.updated_at = new Date();

      const result = await this.kysely
        .updateTable("corporations")
        .set(updateData)
        .where("id", "=", id)
        .executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error updating corporation:", error);
      return false;
    }
  }

  /**
   * Delete a corporation by ID
   */
  async deleteCorporation(id: string): Promise<boolean> {
    try {
      const result = await this.kysely
        .deleteFrom("corporations")
        .where("id", "=", id)
        .executeTakeFirst();
      return result.numDeletedRows > 0;
    } catch (error) {
      console.error("Error deleting corporation:", error);
      return false;
    }
  }

  /**
   * Update influence base balance and timestamp
   */
  async updateInfluenceBase(
    corporationId: string,
    newBase: number,
  ): Promise<boolean> {
    try {
      const result = await this.kysely
        .updateTable("corporations" as any)
        .set({
          influence_base: newBase.toString(),
          influence_last_updated_at: sql`now()`,
          updated_at: sql`now()`,
        } as any)
        .where("id", "=", corporationId)
        .executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error updating influence base:", error);
      return false;
    }
  }

  /**
   * Map database record to CorporationDto
   */
  private mapRecordToDto(record: any): CorporationDto {
    const dto = new CorporationDto();
    dto.id = record.id;
    dto.name = record.name;
    dto.description = record.description;
    dto.industry = record.industry;
    dto.isActive = record.is_active;
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    dto.influenceBase = record.influence_base ? parseFloat(record.influence_base.toString()) : 0;
    dto.influenceLastUpdatedAt = record.influence_last_updated_at || null;
    return dto;
  }
}

