import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { BusinessOutputDto } from "../dtos/business-output.dto";
import { CreateBusinessOutputDto } from "../dtos/create-business-output.dto";

@Injectable()
export class BusinessOutputDao extends KyselyDao<BusinessOutputDao> {
  /**
   * Create a business output production
   */
  async createOutput(
    businessId: string,
    output: CreateBusinessOutputDto
  ): Promise<string | null> {
    try {
      const result = await this.kysely
        .insertInto("business_outputs" as any)
        .values({
          business_id: businessId,
          asset_id: output.assetId,
          quantity: output.quantity,
          name: output.name,
          production_time: output.productionTime,
        } as any)
        .returning("id")
        .executeTakeFirst();

      return (result?.id as string) || null;
    } catch (error) {
      console.error("Error creating business output:", error);
      return null;
    }
  }

  /**
   * Get all outputs for a business
   */
  async getOutputsByBusinessId(
    businessId: string
  ): Promise<BusinessOutputDto[]> {
    try {
      const query = this.kysely
        .selectFrom("business_outputs" as any)
        .selectAll() as any;
      const results = await query.where("business_id", "=", businessId).execute();

      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching business outputs:", error);
      return [];
    }
  }

  /**
   * Delete all outputs for a business
   */
  async deleteOutputsByBusinessId(businessId: string): Promise<boolean> {
    try {
      const query = this.kysely.deleteFrom("business_outputs" as any) as any;
      const result = await query.where("business_id", "=", businessId).executeTakeFirst();

      return result.numDeletedRows > 0;
    } catch (error) {
      console.error("Error deleting business outputs:", error);
      return false;
    }
  }

  /**
   * Delete a specific output
   */
  async deleteOutput(outputId: string): Promise<boolean> {
    try {
      const query = this.kysely.deleteFrom("business_outputs" as any) as any;
      const result = await query.where("id", "=", outputId).executeTakeFirst();

      return result.numDeletedRows > 0;
    } catch (error) {
      console.error("Error deleting business output:", error);
      return false;
    }
  }

  /**
   * Map database record to BusinessOutputDto
   */
  private mapRecordToDto(record: any): BusinessOutputDto {
    const dto = new BusinessOutputDto();
    dto.id = record.id;
    dto.businessId = record.business_id;
    dto.assetId = record.asset_id;
    dto.quantity = parseFloat(record.quantity);
    dto.name = record.name;
    dto.productionTime = record.production_time;
    return dto;
  }
}

