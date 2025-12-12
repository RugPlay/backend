import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { ProfileDto } from "../dtos/profile.dto";
import { sql } from "kysely";

@Injectable()
export class ProfileDao extends KyselyDao<ProfileDao> {

  async create(data: Partial<ProfileDto>): Promise<ProfileDto | null> {
    try {
      const profile = await this.kysely
        .insertInto('profiles')
        .values({
          ...data,
          created_at: new Date(),
          updated_at: new Date(),
        } as any)
        .returningAll()
        .executeTakeFirst();
      return profile as any || null;
    } catch (error) {
      console.error("Error creating profile:", error);
      return null;
    }
  }

  async findById(id: string): Promise<ProfileDto | null> {
    try {
      const result = await this.kysely
        .selectFrom('profiles')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return result as any || null;
    } catch (error) {
      console.error("Error finding profile by ID:", error);
      return null;
    }
  }

  async findByIdentityId(identityId: string): Promise<ProfileDto | null> {
    try {
      const result = await this.kysely
        .selectFrom('profiles')
        .selectAll()
        .where('identity_id', '=', identityId)
        .executeTakeFirst();
      return result as any || null;
    } catch (error) {
      console.error("Error finding profile by identity ID:", error);
      return null;
    }
  }

  async update(id: string, data: Partial<ProfileDto>): Promise<ProfileDto | null> {
    try {
      const profile = await this.kysely
        .updateTable('profiles')
        .set({
          ...data,
          updated_at: new Date(),
        } as any)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      return profile as any || null;
    } catch (error) {
      console.error("Error updating profile:", error);
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.kysely
        .deleteFrom('profiles')
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numDeletedRows > 0;
    } catch (error) {
      console.error("Error deleting profile:", error);
      return false;
    }
  }
}
