import { Module } from "@nestjs/common";
import { BusinessController } from "./controllers/business.controller";
import { BusinessService } from "./services/business.service";
import { BusinessDao } from "./daos/business.dao";
import { BusinessInputDao } from "./daos/business-input.dao";
import { BusinessOutputDao } from "./daos/business-output.dao";
import { BusinessProductionDao } from "./daos/business-production.dao";
import { BusinessFactory } from "./factories/business-factory";
import { SpecialBusinessStrategies } from "./strategies/special-business-strategies";
import { CorporationsModule } from "@/modules/corporations/corporations.module";
import { AssetsModule } from "@/modules/assets/assets.module";

@Module({
  imports: [CorporationsModule, AssetsModule],
  controllers: [BusinessController],
  providers: [
    BusinessService,
    BusinessDao,
    BusinessInputDao,
    BusinessOutputDao,
    BusinessProductionDao,
    BusinessFactory,
    SpecialBusinessStrategies,
  ],
  exports: [
    BusinessService,
    BusinessDao,
    BusinessInputDao,
    BusinessOutputDao,
    BusinessProductionDao,
    BusinessFactory,
    SpecialBusinessStrategies,
  ],
})
export class BusinessesModule {}

