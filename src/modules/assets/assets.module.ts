import { Module } from "@nestjs/common";
import { AssetController } from "./controllers/asset.controller";
import { HoldingController } from "./controllers/holding.controller";
import { AssetService } from "./services/asset.service";
import { HoldingService } from "./services/holding.service";
import { AssetDao } from "./daos/asset.dao";
import { AssetHoldingDao } from "./daos/asset-holding.dao";

@Module({
  controllers: [AssetController, HoldingController],
  providers: [AssetService, HoldingService, AssetDao, AssetHoldingDao],
  exports: [AssetService, HoldingService, AssetDao, AssetHoldingDao],
})
export class AssetsModule {}

