import { Injectable } from "@nestjs/common";
import { KnexDao } from "@/database/knex/knex.dao";
import { ProfileDto } from "../dtos/profile.dto";

@Injectable()
export class ProfileDao extends KnexDao<ProfileDao> {
  protected tableName = "profiles";

  async create(data: Partial<ProfileDto>): Promise<ProfileDto> {
    const [profile] = await this.knex(this.tableName)
      .insert({
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");
    return profile;
  }

  async findById(id: string): Promise<ProfileDto | null> {
    const result = await this.knex(this.tableName).where({ id }).first();
    return result || null;
  }

  async findByIdentityId(identityId: string): Promise<ProfileDto | null> {
    const result = await this.knex(this.tableName)
      .where({ identity_id: identityId })
      .first();
    return result || null;
  }

  async update(id: string, data: Partial<ProfileDto>): Promise<ProfileDto | null> {
    const [profile] = await this.knex(this.tableName)
      .where({ id })
      .update({
        ...data,
        updated_at: new Date(),
      })
      .returning("*");
    return profile || null;
  }

  async delete(id: string): Promise<boolean> {
    const count = await this.knex(this.tableName).where({ id }).delete();
    return count > 0;
  }
}
