import { CreateBusinessInputDto } from "../../../src/modules/businesses/dtos/create-business-input.dto";
import { BusinessInputDto } from "../../../src/modules/businesses/dtos/business-input.dto";
import { v4 as uuidv4 } from "uuid";

/**
 * In-memory implementation of BusinessInputDao for testing
 * Note: Does not extend BusinessInputDao to avoid Kysely dependency
 */
export class InMemoryBusinessInputDao {
  private inputs: Map<string, BusinessInputDto> = new Map();

  async createInput(
    businessId: string,
    input: CreateBusinessInputDto
  ): Promise<string | null> {
    const id = uuidv4();
    const now = new Date();
    const inputDto: BusinessInputDto = {
      id,
      businessId,
      assetId: input.assetId,
      assetName: `Asset ${input.assetId}`,
      quantity: input.quantity,
      createdAt: now,
      updatedAt: now,
    };
    this.inputs.set(id, inputDto);
    return id;
  }

  async getInputsByBusinessId(businessId: string): Promise<BusinessInputDto[]> {
    return Array.from(this.inputs.values()).filter(
      (input) => input.businessId === businessId
    );
  }

  async deleteInput(inputId: string): Promise<boolean> {
    return this.inputs.delete(inputId);
  }

  async deleteInputsByBusinessId(businessId: string): Promise<boolean> {
    const inputsToDelete = Array.from(this.inputs.entries()).filter(
      ([_, input]) => input.businessId === businessId
    );
    inputsToDelete.forEach(([id]) => this.inputs.delete(id));
    return inputsToDelete.length > 0;
  }

  // Test helper methods
  clear(): void {
    this.inputs.clear();
  }

  getAll(): BusinessInputDto[] {
    return Array.from(this.inputs.values());
  }
}

