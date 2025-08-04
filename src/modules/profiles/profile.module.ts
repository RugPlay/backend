import { Module } from "@nestjs/common";
import { ProfileService } from "@/modules/profiles/services/profile.service";
import { ProfileController } from "@/modules/profiles/controllers/profile.controller";
import { ProfileDao } from "@/modules/profiles/daos/profile.dao";

@Module({
  imports: [],
  providers: [ProfileService, ProfileDao],
  exports: [ProfileService, ProfileDao],
  controllers: [ProfileController],
})
export class ProfileModule {}
