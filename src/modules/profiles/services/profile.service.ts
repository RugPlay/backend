import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ProfileDao } from "@/modules/profiles/daos/profile.dao";
import { ProfileDto } from "../dtos/profile.dto";

@Injectable()
export class ProfileService {
  constructor(
    private readonly config: ConfigService,
    private readonly profileDao: ProfileDao,
  ) {}

  async createProfile(data: Partial<ProfileDto>): Promise<ProfileDto> {
    return this.profileDao.create(data);
  }

  async getProfileById(id: string): Promise<ProfileDto> {
    const profile = await this.profileDao.findById(id);
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${id} not found`);
    }
    return profile;
  }

  async getProfileByIdentityId(identityId: string): Promise<ProfileDto> {
    const profile = await this.profileDao.findByIdentityId(identityId);
    if (!profile) {
      throw new NotFoundException(
        `Profile with identityId ${identityId} not found`,
      );
    }
    return profile;
  }

  async updateProfile(
    id: string,
    data: Partial<ProfileDto>,
  ): Promise<ProfileDto> {
    const profile = await this.profileDao.update(id, data);
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${id} not found`);
    }
    return profile;
  }

  async deleteProfile(id: string): Promise<void> {
    const deleted = await this.profileDao.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Profile with ID ${id} not found`);
    }
  }
}
