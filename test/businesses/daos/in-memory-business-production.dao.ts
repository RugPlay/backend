import { BusinessProductionRecord } from "../../../src/modules/businesses/daos/business-production.dao";
import { v4 as uuidv4 } from "uuid";

/**
 * In-memory implementation of BusinessProductionDao for testing
 * Note: Does not extend BusinessProductionDao to avoid Kysely dependency
 */
export class InMemoryBusinessProductionDao {
  private productionRecords: Map<string, BusinessProductionRecord> = new Map();

  async getOrCreateProduction(
    businessId: string
  ): Promise<BusinessProductionRecord | null> {
    if (!this.productionRecords.has(businessId)) {
      const now = new Date();
      this.productionRecords.set(businessId, {
        id: uuidv4(),
        business_id: businessId,
        accumulated_time: 0,
        last_updated: now,
        created_at: now,
        updated_at: now,
      });
    }
    return this.productionRecords.get(businessId) || null;
  }

  async addTime(businessId: string, timeSeconds: number): Promise<boolean> {
    const record = await this.getOrCreateProduction(businessId);
    if (!record) return false;

    record.accumulated_time += timeSeconds;
    record.last_updated = new Date();
    record.updated_at = new Date();
    return true;
  }

  async consumeTime(businessId: string, timeSeconds: number): Promise<boolean> {
    const record = this.productionRecords.get(businessId);
    if (!record) return false;

    record.accumulated_time = Math.max(0, record.accumulated_time - timeSeconds);
    record.updated_at = new Date();
    return true;
  }

  async getAccumulatedTime(businessId: string): Promise<number> {
    const record = await this.getOrCreateProduction(businessId);
    return record?.accumulated_time || 0;
  }

  async resetProduction(businessId: string): Promise<boolean> {
    const record = this.productionRecords.get(businessId);
    if (!record) return false;

    record.accumulated_time = 0;
    record.last_updated = new Date();
    record.updated_at = new Date();
    return true;
  }

  // Test helper methods
  clear(): void {
    this.productionRecords.clear();
  }

  getRecord(businessId: string): BusinessProductionRecord | undefined {
    return this.productionRecords.get(businessId);
  }

  setRecord(businessId: string, record: Partial<BusinessProductionRecord>): void {
    const existing = this.productionRecords.get(businessId);
    const now = new Date();
    this.productionRecords.set(businessId, {
      id: existing?.id || uuidv4(),
      business_id: businessId,
      accumulated_time: record.accumulated_time ?? existing?.accumulated_time ?? 0,
      last_updated: record.last_updated ?? existing?.last_updated ?? now,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
  }
}

