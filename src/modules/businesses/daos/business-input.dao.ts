import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { BusinessInputDto } from "../dtos/business-input.dto";
import { CreateBusinessInputDto } from "../dtos/create-business-input.dto";

@Injectable()
export class BusinessInputDao extends KyselyDao<BusinessInputDao> {
  /**
   * Create a business input requirement
   */
  async createInput(
    businessId: string,
    input: CreateBusinessInputDto
  ): Promise<string | null> {
    try {
      const result = await this.kysely
        .insertInto("business_inputs" as any)
        .values({
          business_id: businessId,
          asset_id: input.assetId,
          quantity: input.quantity,
          name: input.name,
        } as any)
        .returning("id")
        .executeTakeFirst();

      return result?.id || null;
    } catch (error) {
      console.error("Error creating business input:", error);
      return null;
    }
  }

  /**
   * Get all inputs for a business
   */
  async getInputsByBusinessId(businessId: string): Promise<BusinessInputDto[]> {
    try {
      const query = this.kysely
        .selectFrom("business_inputs" as any)
        .selectAll() as any;
      const results = await query.where("business_id", "=", businessId).execute();

      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching business inputs:", error);
      return [];
    }
  }

  /**
   * Delete all inputs for a business
   */
  async deleteInputsByBusinessId(businessId: string): Promise<boolean> {
    try {
      const query = this.kysely.deleteFrom("business_inputs" as any) as any;
      const result = await query.where("business_id", "=", businessId).executeTakeFirst();

      return result.numDeletedRows > 0;
    } catch (error) {
      console.error("Error deleting business inputs:", error);
      return false;
    }
  }

  /**
   * Delete a specific input
   */
  async deleteInput(inputId: string): Promise<boolean> {
    try {
      const query = this.kysely.deleteFrom("business_inputs" as any) as any;
      const result = await query.where("id", "=", inputId).executeTakeFirst();

      return result.numDeletedRows > 0;
    } catch (error) {
      console.error("Error deleting business input:", error);
      return false;
    }
  }

  /**
   * Map database record to BusinessInputDto
   */
  private mapRecordToDto(record: any): BusinessInputDto {
    const dto = new BusinessInputDto();
    dto.id = record.id;
    dto.businessId = record.business_id;
    dto.assetId = record.asset_id;
    dto.quantity = parseFloat(record.quantity);
    dto.name = record.name;
    return dto;
  }
}

