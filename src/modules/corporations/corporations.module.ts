import { Module } from "@nestjs/common";
import { CorporationController } from "./controllers/corporation.controller";
import { CorporationService } from "./services/corporation.service";
import { CorporationDao } from "./daos/corporation.dao";

@Module({
  controllers: [CorporationController],
  providers: [CorporationService, CorporationDao],
  exports: [CorporationService, CorporationDao],
})
export class CorporationsModule {}

