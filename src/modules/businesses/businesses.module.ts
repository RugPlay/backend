import { Module } from "@nestjs/common";
import { BusinessController } from "./controllers/business.controller";
import { BusinessService } from "./services/business.service";
import { BusinessDao } from "./daos/business.dao";
import { CorporationsModule } from "@/modules/corporations/corporations.module";

@Module({
  imports: [CorporationsModule],
  controllers: [BusinessController],
  providers: [BusinessService, BusinessDao],
  exports: [BusinessService, BusinessDao],
})
export class BusinessesModule {}

