import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { BusinessService } from "../../src/modules/businesses/services/business.service";
import { AssetService } from "../../src/modules/assets/services/asset.service";
import { CorporationService } from "../../src/modules/corporations/services/corporation.service";
import { AssetHoldingDao } from "../../src/modules/assets/daos/asset-holding.dao";
import { TestCleanupHelper } from "../helpers/test-cleanup.helper";
import { BusinessTestHelper } from "../businesses/helpers/business-test.helper";
import { v4 as uuidv4 } from "uuid";
import { Kysely, sql } from "kysely";
import { DB } from "../../src/database/types/db";

describe("Businesses (e2e)", () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let businessService: BusinessService;
  let assetService: AssetService;
  let corporationService: CorporationService;
  let assetHoldingDao: AssetHoldingDao;
  let testCorporationId: string;
  let wheatAssetId: string;
  let usdAssetId: string;
  let ironAssetId: string;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({
      logger: false,
    });
    await app.init();

    businessService = moduleFixture.get<BusinessService>(BusinessService);
    assetService = moduleFixture.get<AssetService>(AssetService);
    corporationService =
      moduleFixture.get<CorporationService>(CorporationService);
    assetHoldingDao = moduleFixture.get<AssetHoldingDao>(AssetHoldingDao);

    // Ensure business tables exist
    await ensureBusinessTablesExist();

    await setupTestData();
  });

  afterAll(async () => {
    await TestCleanupHelper.cleanupTestData(app);
    await app.close();
  });

  async function ensureBusinessTablesExist() {
    const kysely = (assetHoldingDao as any).kysely as Kysely<DB>;

    try {
      // Check if business_inputs table exists
      const inputsCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'business_inputs'
        )
      `.execute(kysely);
      
      const inputsExists = (inputsCheck as any)?.rows?.[0]?.exists || false;
      
      if (!inputsExists) {
        // Create business_inputs table
        await sql`
          CREATE TABLE IF NOT EXISTS business_inputs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
            quantity NUMERIC NOT NULL,
            name VARCHAR(255),
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
          )
        `.execute(kysely);

        await sql`
          CREATE INDEX IF NOT EXISTS idx_business_inputs_business_id 
          ON business_inputs(business_id)
        `.execute(kysely);

        await sql`
          CREATE INDEX IF NOT EXISTS idx_business_inputs_asset_id 
          ON business_inputs(asset_id)
        `.execute(kysely);
      }

      // Check if business_outputs table exists
      const outputsCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'business_outputs'
        )
      `.execute(kysely);
      
      const outputsExists = (outputsCheck as any)?.rows?.[0]?.exists || false;
      
      if (!outputsExists) {
        // Create business_outputs table
        await sql`
          CREATE TABLE IF NOT EXISTS business_outputs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
            quantity NUMERIC NOT NULL,
            name VARCHAR(255),
            production_time INTEGER,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
          )
        `.execute(kysely);

        await sql`
          CREATE INDEX IF NOT EXISTS idx_business_outputs_business_id 
          ON business_outputs(business_id)
        `.execute(kysely);

        await sql`
          CREATE INDEX IF NOT EXISTS idx_business_outputs_asset_id 
          ON business_outputs(asset_id)
        `.execute(kysely);
      }

      // Check if business_production table exists
      const productionCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'business_production'
        )
      `.execute(kysely);
      
      const productionExists = (productionCheck as any)?.rows?.[0]?.exists || false;
      
      if (!productionExists) {
        // Create business_production table
        await sql`
          CREATE TABLE IF NOT EXISTS business_production (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
            accumulated_time INTEGER NOT NULL DEFAULT 0,
            last_updated TIMESTAMP NOT NULL DEFAULT now(),
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
          )
        `.execute(kysely);

        await sql`
          CREATE INDEX IF NOT EXISTS idx_business_production_business_id 
          ON business_production(business_id)
        `.execute(kysely);
      }
    } catch (error) {
      console.error("Error ensuring business tables exist:", error);
      // Don't throw - tables might already exist or migrations might have run
    }
  }

  async function setupTestData() {
    // Create test corporation
    const corporation = await corporationService.createCorporation({
      name: `Test Corp ${Date.now()}`,
      industry: "agriculture",
    });
    testCorporationId = corporation.id;

    // Create test assets
    const usd = await assetService.createAsset({
      symbol: "USD",
      name: "US Dollar",
      type: "currency",
    });
    usdAssetId = usd.id;

    const wheat = await assetService.createAsset({
      symbol: `WHEAT_${Date.now()}`,
      name: "Wheat",
      type: "commodity",
    });
    wheatAssetId = wheat.id;

    const iron = await assetService.createAsset({
      symbol: `IRON_${Date.now()}`,
      name: "Iron Ore",
      type: "commodity",
    });
    ironAssetId = iron.id;
  }

  describe("POST /businesses", () => {
    it("should create a business", async () => {
      const uniqueName = `Test Farm ${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post("/businesses")
        .send({
          name: uniqueName,
          category: "agriculture",
          corporationId: testCorporationId,
          outputs: [
            {
              assetId: wheatAssetId,
              quantity: 5,
              productionTime: 60,
            },
          ],
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toContain("Test Farm");
      expect(response.body.category).toBe("agriculture");
      expect(response.body.corporationId).toBe(testCorporationId);
    });

    it("should create a business with inputs and outputs", async () => {
      const uniqueName = `Test Factory ${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post("/businesses")
        .send({
          name: uniqueName,
          category: "industry_manufacturing",
          corporationId: testCorporationId,
          inputs: [
            {
              assetId: wheatAssetId,
              quantity: 2,
            },
            {
              assetId: ironAssetId,
              quantity: 1,
            },
          ],
          outputs: [
            {
              assetId: wheatAssetId,
              quantity: 1,
              productionTime: 300,
            },
          ],
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.inputs).toBeDefined();
      expect(response.body.outputs).toBeDefined();
      expect(response.body.inputs.length).toBe(2);
      expect(response.body.outputs.length).toBe(1);
    });

    it("should return 400 for invalid business type", async () => {
      await request(app.getHttpServer())
        .post("/businesses")
        .send({
          name: "Test Business",
          category: "invalid_type",
          corporationId: testCorporationId,
        })
        .expect(400);
    });

    it("should return 404 for non-existent corporation", async () => {
      await request(app.getHttpServer())
        .post("/businesses")
        .send({
          name: "Test Business",
          category: "agriculture",
          corporationId: uuidv4(),
        })
        .expect(404);
    });
  });

  describe("GET /businesses", () => {
    it("should return list of businesses", async () => {
      // Create a test business first
      await businessService.createBusiness({
        name: `List Test Business ${Date.now()}`,
        category: "agriculture",
        corporationId: testCorporationId,
      });

      const response = await request(app.getHttpServer())
        .get("/businesses")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it("should filter by corporation ID", async () => {
      const response = await request(app.getHttpServer())
        .get(`/businesses?corporationId=${testCorporationId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((business: any) => {
        expect(business.corporationId).toBe(testCorporationId);
      });
    });

    it("should filter by category", async () => {
      const response = await request(app.getHttpServer())
        .get("/businesses?category=agriculture")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((business: any) => {
        expect(business.category).toBe("agriculture");
      });
    });
  });

  describe("GET /businesses/:id", () => {
    it("should return a business by ID", async () => {
      const business = await businessService.createBusiness({
        name: `Get Test Business ${Date.now()}`,
        category: "agriculture",
        corporationId: testCorporationId,
      });

      const response = await request(app.getHttpServer())
        .get(`/businesses/${business.id}`)
        .expect(200);

      expect(response.body.id).toBe(business.id);
      expect(response.body.name).toContain("Get Test Business");
    });

    it("should return 404 for non-existent business", async () => {
      await request(app.getHttpServer())
        .get(`/businesses/${uuidv4()}`)
        .expect(404);
    });
  });

  describe("POST /businesses/:id/production/time", () => {
    it("should add production time", async () => {
      const business = await BusinessTestHelper.createTestAgricultureBusiness(
        businessService,
        assetService,
        testCorporationId
      );

      const response = await request(app.getHttpServer())
        .post(`/businesses/${business.business.id}/production/time`)
        .send({ timeSeconds: 120 })
        .expect(200);

      expect(response.body.accumulatedTime).toBe(120);
      expect(response.body.availableOutputs).toBeDefined();
      expect(Array.isArray(response.body.availableOutputs)).toBe(true);
    });

    it("should return 404 for non-existent business", async () => {
      await request(app.getHttpServer())
        .post(`/businesses/${uuidv4()}/production/time`)
        .send({ timeSeconds: 120 })
        .expect(404);
    });
  });

  describe("GET /businesses/:id/production/progress", () => {
    it("should return production progress", async () => {
      const business = await BusinessTestHelper.createTestAgricultureBusiness(
        businessService,
        assetService,
        testCorporationId
      );

      // Add some production time
      await businessService.addProductionTime(business.business.id, {
        timeSeconds: 180,
      });

      const response = await request(app.getHttpServer())
        .get(`/businesses/${business.business.id}/production/progress`)
        .expect(200);

      expect(response.body.businessId).toBe(business.business.id);
      expect(response.body.accumulatedTime).toBe(180);
      expect(response.body.availableOutputs).toBeDefined();
    });
  });

  describe("POST /businesses/:id/production/claim", () => {
    it("should claim outputs and add to holdings", async () => {
      const business = await BusinessTestHelper.createTestAgricultureBusiness(
        businessService,
        assetService,
        testCorporationId
      );

      // Add production time (enough for 2 cycles: 120s / 30s effective = 4 cycles)
      await businessService.addProductionTime(business.business.id, {
        timeSeconds: 120,
      });

      const output = business.business.outputs![0];

      const response = await request(app.getHttpServer())
        .post(`/businesses/${business.business.id}/production/claim`)
        .send({ outputId: output.id })
        .expect(200);

      expect(response.body.quantity).toBeGreaterThan(0);
      expect(response.body.cyclesClaimed).toBeGreaterThan(0);
      expect(response.body.assetId).toBe(business.wheatAssetId);

      // Verify holdings were updated
      const holding = await assetHoldingDao.getAsset(
        testCorporationId,
        business.wheatAssetId
      );
      expect(holding).toBeDefined();
      expect(holding?.quantity).toBeGreaterThan(0);
    });

    it("should consume inputs when claiming outputs", async () => {
      // Create manufacturing business with inputs
      const manufacturing = await BusinessTestHelper.createTestManufacturingBusiness(
        businessService,
        assetService,
        testCorporationId,
        wheatAssetId,
        ironAssetId
      );

      // Add inputs to holdings
      await assetHoldingDao.adjustAssetQuantity(
        testCorporationId,
        wheatAssetId,
        20
      );
      await assetHoldingDao.adjustAssetQuantity(
        testCorporationId,
        ironAssetId,
        10
      );

      // Add production time
      await businessService.addProductionTime(manufacturing.business.id, {
        timeSeconds: 600, // Enough for 1 cycle (600 / (300/1.0) = 2 cycles)
      });

      const output = manufacturing.business.outputs![0];
      const initialWheat = await assetHoldingDao.getAsset(
        testCorporationId,
        wheatAssetId
      );
      const initialIron = await assetHoldingDao.getAsset(
        testCorporationId,
        ironAssetId
      );

      const response = await request(app.getHttpServer())
        .post(`/businesses/${manufacturing.business.id}/production/claim`)
        .send({ outputId: output.id })
        .expect(200);

      // Verify inputs were consumed
      const finalWheat = await assetHoldingDao.getAsset(
        testCorporationId,
        wheatAssetId
      );
      const finalIron = await assetHoldingDao.getAsset(
        testCorporationId,
        ironAssetId
      );

      expect(finalWheat?.quantity).toBeLessThan(initialWheat!.quantity);
      expect(finalIron?.quantity).toBeLessThan(initialIron!.quantity);
    });

    it("should return 400 if insufficient inputs", async () => {
      const manufacturing = await BusinessTestHelper.createTestManufacturingBusiness(
        businessService,
        assetService,
        testCorporationId,
        wheatAssetId,
        ironAssetId
      );

      // Reload business to ensure inputs are loaded
      const business = await businessService.getBusinessById(manufacturing.business.id);
      expect(business.inputs).toBeDefined();
      expect(business.inputs!.length).toBeGreaterThan(0);

      // Don't add inputs to holdings - ensure they're missing
      // Reset holdings to 0 to ensure clean state
      await TestCleanupHelper.resetAssetQuantity(app, testCorporationId, wheatAssetId, 0);
      await TestCleanupHelper.resetAssetQuantity(app, testCorporationId, ironAssetId, 0);
      
      // Verify no inputs exist (or very small amount due to precision)
      const wheatHolding = await assetHoldingDao.getAsset(testCorporationId, wheatAssetId);
      const ironHolding = await assetHoldingDao.getAsset(testCorporationId, ironAssetId);
      const wheatQty = wheatHolding ? parseFloat(wheatHolding.quantity.toString()) : 0;
      const ironQty = ironHolding ? parseFloat(ironHolding.quantity.toString()) : 0;
      // Allow small floating point differences, but should be essentially 0
      expect(wheatQty).toBeLessThan(0.01);
      expect(ironQty).toBeLessThan(0.01);

      await businessService.addProductionTime(business.id, {
        timeSeconds: 600,
      });

      const output = business.outputs![0];

      await request(app.getHttpServer())
        .post(`/businesses/${business.id}/production/claim`)
        .send({ outputId: output.id })
        .expect(400);
    });

    it("should return 400 if insufficient production time", async () => {
      const business = await BusinessTestHelper.createTestAgricultureBusiness(
        businessService,
        assetService,
        testCorporationId
      );

      // Don't add production time
      const output = business.business.outputs![0];

      await request(app.getHttpServer())
        .post(`/businesses/${business.business.id}/production/claim`)
        .send({ outputId: output.id, cycles: 1 })
        .expect(400);
    });
  });

  describe("GET /businesses/types/supported", () => {
    it("should return list of supported business types", async () => {
      const response = await request(app.getHttpServer())
        .get("/businesses/types/supported")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toContain("agriculture");
      expect(response.body).toContain("mining");
      expect(response.body).toContain("commerce");
    });
  });

  describe("PUT /businesses/:id", () => {
    it("should update a business", async () => {
      const business = await businessService.createBusiness({
        name: `Update Test Business ${Date.now()}`,
        category: "agriculture",
        corporationId: testCorporationId,
      });

      const updatedName = `Updated Business Name ${Date.now()}`;
      const response = await request(app.getHttpServer())
        .put(`/businesses/${business.id}`)
        .send({
          name: updatedName,
          description: "Updated description",
        })
        .expect(200);

      expect(response.body.name).toBe(updatedName);
      expect(response.body.description).toBe("Updated description");
    });
  });

  describe("DELETE /businesses/:id", () => {
    it("should delete a business", async () => {
      const business = await businessService.createBusiness({
        name: "Delete Test Business",
        category: "agriculture",
        corporationId: testCorporationId,
      });

      await request(app.getHttpServer())
        .delete(`/businesses/${business.id}`)
        .expect(204);

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/businesses/${business.id}`)
        .expect(404);
    });
  });
});

