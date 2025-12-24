import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { InjectKysely } from "nestjs-kysely";
import { Kysely } from "kysely";
import { DB } from "@/database/types/db";
import { CreateBusinessDto } from "../dtos/create-business.dto";
import { UpdateBusinessDto } from "../dtos/update-business.dto";
import { BusinessFiltersDto } from "../dtos/business-filters.dto";
import { BusinessDto } from "../dtos/business.dto";
import { BusinessInputDao } from "./business-input.dao";
import { BusinessOutputDao } from "./business-output.dao";

@Injectable()
export class BusinessDao extends KyselyDao<BusinessDao> {
  constructor(
    @InjectKysely() kysely: Kysely<DB>,
    private readonly businessInputDao: BusinessInputDao,
    private readonly businessOutputDao: BusinessOutputDao
  ) {
    super(kysely);
  }
  /**
   * Insert a new business into the database
   * Note: Inputs and outputs should be created separately using BusinessInputDao and BusinessOutputDao
   */
  async createBusiness(business: CreateBusinessDto): Promise<string | null> {
    try {
      const result = await this.kysely
        .insertInto("businesses")
        .values({
          name: business.name,
          description: business.description,
          category: business.category,
          corporation_id: business.corporationId,
          is_active: business.isActive ?? true,
        } as any)
        .returning("id")
        .executeTakeFirst();

      return result?.id || null;
    } catch (error) {
      console.error("Error creating business:", error);
      return null;
    }
  }

  /**
   * Get a business by ID
   */
  async getBusinessById(id: string): Promise<BusinessDto | null> {
    try {
      const result = await this.kysely
        .selectFrom("businesses")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      
      if (!result) {
        return null;
      }

      const business = this.mapRecordToDto(result);
      
      // Load inputs and outputs
      business.inputs = await this.businessInputDao.getInputsByBusinessId(id);
      business.outputs = await this.businessOutputDao.getOutputsByBusinessId(id);
      
      return business;
    } catch (error) {
      console.error("Error fetching business by ID:", error);
      return null;
    }
  }

  /**
   * Get a business by name
   */
  async getBusinessByName(name: string): Promise<BusinessDto | null> {
    try {
      const result = await this.kysely
        .selectFrom("businesses")
        .selectAll()
        .where("name", "=", name)
        .executeTakeFirst();
      return result ? this.mapRecordToDto(result) : null;
    } catch (error) {
      console.error("Error fetching business by name:", error);
      return null;
    }
  }

  /**
   * Get all businesses with optional filters
   */
  async getBusinesses(filters?: BusinessFiltersDto): Promise<BusinessDto[]> {
    try {
      let query = this.kysely.selectFrom("businesses").selectAll();

      if (filters?.category) {
        query = query.where("category", "=", filters.category);
      }

      if (filters?.isActive !== undefined) {
        query = query.where("is_active", "=", filters.isActive);
      }

      if (filters?.name) {
        query = query.where("name", "ilike", `%${filters.name}%`);
      }

      if (filters?.corporationId) {
        query = query.where("corporation_id", "=", filters.corporationId);
      }

      const results = await query.orderBy("name", "asc").execute();
      const businesses = results.map((record) => this.mapRecordToDto(record));
      
      // Load inputs and outputs for each business
      for (const business of businesses) {
        business.inputs = await this.businessInputDao.getInputsByBusinessId(business.id);
        business.outputs = await this.businessOutputDao.getOutputsByBusinessId(business.id);
      }
      
      return businesses;
    } catch (error) {
      console.error("Error fetching businesses:", error);
      return [];
    }
  }

  /**
   * Get all active businesses
   */
  async getActiveBusinesses(): Promise<BusinessDto[]> {
    try {
      const results = await this.kysely
        .selectFrom("businesses")
        .selectAll()
        .where("is_active", "=", true)
        .orderBy("name", "asc")
        .execute();
      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching active businesses:", error);
      return [];
    }
  }

  /**
   * Update a business
   */
  async updateBusiness(
    id: string,
    business: UpdateBusinessDto
  ): Promise<boolean> {
    try {
      const updateData: any = {};

      if (business.name !== undefined) updateData.name = business.name;
      if (business.description !== undefined)
        updateData.description = business.description;
      if (business.category !== undefined)
        updateData.category = business.category;
      if (business.corporationId !== undefined)
        updateData.corporation_id = business.corporationId;
      if (business.isActive !== undefined)
        updateData.is_active = business.isActive;

      updateData.updated_at = new Date();

      const result = await this.kysely
        .updateTable("businesses")
        .set(updateData)
        .where("id", "=", id)
        .executeTakeFirst();

      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error updating business:", error);
      return false;
    }
  }

  /**
   * Delete a business by ID
   */
  async deleteBusiness(id: string): Promise<boolean> {
    try {
      const result = await this.kysely
        .deleteFrom("businesses")
        .where("id", "=", id)
        .executeTakeFirst();
      return result.numDeletedRows > 0;
    } catch (error) {
      console.error("Error deleting business:", error);
      return false;
    }
  }

  /**
   * Map database record to BusinessDto
   */
  private mapRecordToDto(record: any): BusinessDto {
    const dto = new BusinessDto();
    dto.id = record.id;
    dto.name = record.name;
    dto.description = record.description;
    dto.category = record.category;
    dto.corporationId = record.corporation_id;
    dto.isActive = record.is_active;
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    return dto;
  }
}

