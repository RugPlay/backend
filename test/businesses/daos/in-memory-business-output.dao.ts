import { CreateBusinessOutputDto } from "../../../src/modules/businesses/dtos/create-business-output.dto";
import { BusinessOutputDto } from "../../../src/modules/businesses/dtos/business-output.dto";
import { v4 as uuidv4 } from "uuid";

/**
 * In-memory implementation of BusinessOutputDao for testing
 * Note: Does not extend BusinessOutputDao to avoid Kysely dependency
 */
export class InMemoryBusinessOutputDao {
  private outputs: Map<string, BusinessOutputDto> = new Map();

  async createOutput(
    businessId: string,
    output: CreateBusinessOutputDto
  ): Promise<string | null> {
    const id = uuidv4();
    const now = new Date();
    const outputDto: BusinessOutputDto = {
      id,
      businessId,
      assetId: output.assetId,
      assetName: `Asset ${output.assetId}`,
      quantity: output.quantity,
      productionTime: output.productionTime,
      createdAt: now,
      updatedAt: now,
    };
    this.outputs.set(id, outputDto);
    return id;
  }

  async getOutputsByBusinessId(businessId: string): Promise<BusinessOutputDto[]> {
    return Array.from(this.outputs.values()).filter(
      (output) => output.businessId === businessId
    );
  }

  async deleteOutput(outputId: string): Promise<boolean> {
    return this.outputs.delete(outputId);
  }

  async deleteOutputsByBusinessId(businessId: string): Promise<boolean> {
    const outputsToDelete = Array.from(this.outputs.entries()).filter(
      ([_, output]) => output.businessId === businessId
    );
    outputsToDelete.forEach(([id]) => this.outputs.delete(id));
    return outputsToDelete.length > 0;
  }

  // Test helper methods
  clear(): void {
    this.outputs.clear();
  }

  getAll(): BusinessOutputDto[] {
    return Array.from(this.outputs.values());
  }
}

