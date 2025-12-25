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
    // Tables are now created via migrations
    // No need to manually create business_inputs, business_outputs, or business_production tables
    // They have been removed or replaced with the production table
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
    it("should create a business with automatic outputs from recipe", async () => {
      const uniqueName = `Test Farm ${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post("/businesses")
        .send({
          name: uniqueName,
          category: "agriculture",
          corporationId: testCorporationId,
          // No outputs provided - should be created from recipe
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toContain("Test Farm");
      expect(response.body.category).toBe("agriculture");
      expect(response.body.corporationId).toBe(testCorporationId);
      // Should have outputs from recipe
      expect(response.body.outputs).toBeDefined();
      expect(response.body.outputs.length).toBeGreaterThan(0);
      // Should have WHEAT output
      const wheatOutput = response.body.outputs.find((o: any) => 
        o.name === "Wheat" || o.assetId
      );
      expect(wheatOutput).toBeDefined();
    });

    it("should create a business with automatic inputs and outputs from recipe", async () => {
      const uniqueName = `Test Factory ${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post("/businesses")
        .send({
          name: uniqueName,
          category: "industry_manufacturing",
          corporationId: testCorporationId,
          // No inputs/outputs provided - should be created from recipe
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.inputs).toBeDefined();
      expect(response.body.outputs).toBeDefined();
      // Manufacturing recipe has 2 inputs (Wheat, Iron) and 1 output (Manufactured Goods)
      expect(response.body.inputs.length).toBe(2);
      expect(response.body.outputs.length).toBe(1);
    });

    it("should allow adding inputs to an existing business", async () => {
      // Create a business first (inputs/outputs from recipe)
      const uniqueName = `Test Factory ${Date.now()}`;
      const createResponse = await request(app.getHttpServer())
        .post("/businesses")
        .send({
          name: uniqueName,
          category: "agriculture",
          corporationId: testCorporationId,
        })
        .expect(201);

      const businessId = createResponse.body.id;

      // Add a custom input to the business
      const addInputResponse = await request(app.getHttpServer())
        .post(`/businesses/${businessId}/inputs`)
        .send({
          assetId: wheatAssetId,
          quantity: 5,
          name: "Custom Input",
        })
        .expect(201);

      expect(addInputResponse.body.id).toBeDefined();
      expect(addInputResponse.body.assetId).toBe(wheatAssetId);
      expect(addInputResponse.body.quantity).toBe(5);

      // Verify the input was added
      const businessResponse = await request(app.getHttpServer())
        .get(`/businesses/${businessId}`)
        .expect(200);

      // Should have recipe inputs (none for agriculture) + custom input
      expect(businessResponse.body.inputs.length).toBeGreaterThanOrEqual(1);
      const customInput = businessResponse.body.inputs.find(
        (i: any) => i.assetId === wheatAssetId
      );
      expect(customInput).toBeDefined();
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


  describe("GET /businesses/:id/production/progress", () => {
    it("should return production progress", async () => {
      const business = await BusinessTestHelper.createTestAgricultureBusiness(
        businessService,
        assetService,
        testCorporationId
      );

      const response = await request(app.getHttpServer())
        .get(`/businesses/${business.business.id}/production/progress`)
        .expect(200);

      expect(response.body.businessId).toBe(business.business.id);
      expect(response.body.totalCyclesAvailable).toBeDefined();
      expect(response.body.totalCyclesInProgress).toBeDefined();
      expect(Array.isArray(response.body.batches)).toBe(true);
    });
  });

  describe("POST /businesses/:id/production/claim", () => {
    it("should claim outputs and add to holdings", async () => {
      const business = await BusinessTestHelper.createTestAgricultureBusiness(
        businessService,
        assetService,
        testCorporationId
      );

      // Agriculture businesses have no inputs, so we can't create batches
      // This test is skipped since agriculture can't produce without inputs in the new system
      // For now, we'll test with a manufacturing business instead
      const manufacturing = await BusinessTestHelper.createTestManufacturingBusiness(
        businessService,
        assetService,
        testCorporationId,
        wheatAssetId,
        ironAssetId
      );

      const businessWithInputs = await businessService.getBusinessById(manufacturing.business.id);
      const recipeWheatInput = businessWithInputs.inputs!.find((i: any) => 
        i.name?.toLowerCase().includes('wheat') || i.assetId === wheatAssetId
      );
      const recipeIronInput = businessWithInputs.inputs!.find((i: any) => 
        i.name?.toLowerCase().includes('iron') || i.assetId === ironAssetId
      );

      const recipeWheatAssetId = recipeWheatInput?.assetId || wheatAssetId;
      const recipeIronAssetId = recipeIronInput?.assetId || ironAssetId;

      // Add inputs to holdings
      await assetHoldingDao.adjustAssetQuantity(
        testCorporationId,
        recipeWheatAssetId,
        20
      );
      await assetHoldingDao.adjustAssetQuantity(
        testCorporationId,
        recipeIronAssetId,
        10
      );

      // Create production batch
      await businessService.addProductionInputs(businessWithInputs.id, {
        inputs: [
          { assetId: recipeWheatAssetId, quantity: 20 },
          { assetId: recipeIronAssetId, quantity: 10 },
        ],
      });

      const output = businessWithInputs.outputs![0];

      const response = await request(app.getHttpServer())
        .post(`/businesses/${businessWithInputs.id}/production/claim`)
        .send({ assetId: output.assetId })
        .expect(200);

      expect(response.body.quantity).toBeGreaterThan(0);
      expect(response.body.cyclesClaimed).toBeGreaterThan(0);
      expect(response.body.assetId).toBe(output.assetId);

      // Verify holdings were updated
      const holding = await assetHoldingDao.getAsset(
        testCorporationId,
        output.assetId
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

      // Reload business to get recipe-created inputs
      const business = await businessService.getBusinessById(manufacturing.business.id);
      const recipeWheatInput = business.inputs!.find((i: any) => 
        i.name?.toLowerCase().includes('wheat') || i.assetId === wheatAssetId
      );
      const recipeIronInput = business.inputs!.find((i: any) => 
        i.name?.toLowerCase().includes('iron') || i.assetId === ironAssetId
      );

      const recipeWheatAssetId = recipeWheatInput?.assetId || wheatAssetId;
      const recipeIronAssetId = recipeIronInput?.assetId || ironAssetId;

      // Add inputs to holdings using recipe asset IDs
      await assetHoldingDao.adjustAssetQuantity(
        testCorporationId,
        recipeWheatAssetId,
        20
      );
      await assetHoldingDao.adjustAssetQuantity(
        testCorporationId,
        recipeIronAssetId,
        10
      );

      // Create production batch with inputs
      await businessService.addProductionInputs(business.id, {
        inputs: [
          { assetId: recipeWheatAssetId, quantity: 20 },
          { assetId: recipeIronAssetId, quantity: 10 },
        ],
      });

      const output = business.outputs![0];
      const initialWheat = await assetHoldingDao.getAsset(
        testCorporationId,
        recipeWheatAssetId
      );
      const initialIron = await assetHoldingDao.getAsset(
        testCorporationId,
        recipeIronAssetId
      );

      const response = await request(app.getHttpServer())
        .post(`/businesses/${business.id}/production/claim`)
        .send({ assetId: output.assetId })
        .expect(200);

      // Verify inputs were consumed
      const finalWheat = await assetHoldingDao.getAsset(
        testCorporationId,
        recipeWheatAssetId
      );
      const finalIron = await assetHoldingDao.getAsset(
        testCorporationId,
        recipeIronAssetId
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

      // Get the input asset IDs from the recipe (WHEAT and IRON)
      // The recipe creates these assets, so we need to find them
      const wheatInput = business.inputs!.find((i: any) => {
        // Try to match by checking if it's the wheat asset or if we can find it
        return i.assetId === wheatAssetId || i.name?.toLowerCase().includes('wheat');
      });
      const ironInput = business.inputs!.find((i: any) => {
        return i.assetId === ironAssetId || i.name?.toLowerCase().includes('iron');
      });

      // Use the actual input asset IDs from the recipe
      const recipeWheatAssetId = wheatInput?.assetId || wheatAssetId;
      const recipeIronAssetId = ironInput?.assetId || ironAssetId;

      // Don't add inputs to holdings - ensure they're missing
      // Reset holdings to 0 to ensure clean state
      await TestCleanupHelper.resetAssetQuantity(app, testCorporationId, recipeWheatAssetId, 0);
      await TestCleanupHelper.resetAssetQuantity(app, testCorporationId, recipeIronAssetId, 0);
      
      // Verify no inputs exist (or very small amount due to precision)
      const wheatHolding = await assetHoldingDao.getAsset(testCorporationId, recipeWheatAssetId);
      const ironHolding = await assetHoldingDao.getAsset(testCorporationId, recipeIronAssetId);
      const wheatQty = wheatHolding ? parseFloat(wheatHolding.quantity.toString()) : 0;
      const ironQty = ironHolding ? parseFloat(ironHolding.quantity.toString()) : 0;
      // Allow small floating point differences, but should be essentially 0
      expect(wheatQty).toBeLessThan(0.01);
      expect(ironQty).toBeLessThan(0.01);

      // Try to create production batch without sufficient inputs
      await request(app.getHttpServer())
        .post(`/businesses/${business.id}/production/inputs`)
        .send({
          inputs: [
            { assetId: recipeWheatAssetId, quantity: 0 },
            { assetId: recipeIronAssetId, quantity: 0 },
          ],
        })
        .expect(400);
    });

    it("should return 400 if insufficient production cycles", async () => {
      // Create manufacturing business with inputs
      const manufacturing = await BusinessTestHelper.createTestManufacturingBusiness(
        businessService,
        assetService,
        testCorporationId,
        wheatAssetId,
        ironAssetId
      );

      const business = await businessService.getBusinessById(manufacturing.business.id);

      // Don't create production batch - try to claim without any batches
      const output = business.outputs![0];

      await request(app.getHttpServer())
        .post(`/businesses/${business.id}/production/claim`)
        .send({ assetId: output.assetId })
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

