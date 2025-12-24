import { CreateBusinessDto } from "../../../src/modules/businesses/dtos/create-business.dto";
import { BusinessDto } from "../../../src/modules/businesses/dtos/business.dto";
import { UpdateBusinessDto } from "../../../src/modules/businesses/dtos/update-business.dto";
import { BusinessFiltersDto } from "../../../src/modules/businesses/dtos/business-filters.dto";
import { v4 as uuidv4 } from "uuid";

/**
 * In-memory implementation of BusinessDao for testing
 * Provides the same interface as BusinessDao but stores data in memory
 * Note: Does not extend BusinessDao to avoid Kysely dependency
 */
export class InMemoryBusinessDao {
  private businesses: Map<string, BusinessDto> = new Map();

  async createBusiness(business: CreateBusinessDto): Promise<string | null> {
    const id = uuidv4();
    const now = new Date();
    const businessDto: BusinessDto = {
      id,
      name: business.name,
      description: business.description,
      category: business.category,
      corporationId: business.corporationId,
      isActive: business.isActive ?? true,
      inputs: [],
      outputs: [],
      createdAt: now,
      updatedAt: now,
    };
    this.businesses.set(id, businessDto);
    return id;
  }

  async getBusinessById(id: string): Promise<BusinessDto | null> {
    return this.businesses.get(id) || null;
  }

  async getBusinessByName(name: string): Promise<BusinessDto | null> {
    for (const business of this.businesses.values()) {
      if (business.name === name) {
        return business;
      }
    }
    return null;
  }

  async updateBusiness(id: string, business: UpdateBusinessDto): Promise<boolean> {
    const existing = this.businesses.get(id);
    if (!existing) return false;

    this.businesses.set(id, {
      ...existing,
      ...business,
      updatedAt: new Date(),
    });
    return true;
  }

  async deleteBusiness(id: string): Promise<boolean> {
    return this.businesses.delete(id);
  }

  async getBusinesses(filters: BusinessFiltersDto): Promise<BusinessDto[]> {
    let results = Array.from(this.businesses.values());

    if (filters.corporationId) {
      results = results.filter((b) => b.corporationId === filters.corporationId);
    }
    if (filters.category) {
      results = results.filter((b) => b.category === filters.category);
    }
    if (filters.isActive !== undefined) {
      results = results.filter((b) => b.isActive === filters.isActive);
    }
    if (filters.name) {
      results = results.filter((b) =>
        b.name.toLowerCase().includes(filters.name!.toLowerCase())
      );
    }

    return results;
  }

  // Test helper methods
  clear(): void {
    this.businesses.clear();
  }

  getAll(): BusinessDto[] {
    return Array.from(this.businesses.values());
  }

  setBusiness(business: BusinessDto): void {
    this.businesses.set(business.id, business);
  }
}

