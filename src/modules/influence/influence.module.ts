import { Module } from "@nestjs/common";
import { InfluenceController } from "./controllers/influence.controller";
import { InfluenceService } from "./services/influence.service";
import { CorporationsModule } from "@/modules/corporations/corporations.module";
import { AssetsModule } from "@/modules/assets/assets.module";

@Module({
  imports: [CorporationsModule, AssetsModule],
  controllers: [InfluenceController],
  providers: [InfluenceService],
  exports: [InfluenceService],
})
export class InfluenceModule {}

