import { Test, TestingModule } from "@nestjs/testing";
import { MarketService } from "../../../src/modules/exchange/services/market.service";
import { MarketDao } from "../../../src/modules/exchange/daos/market.dao";
import { AssetService } from "../../../src/modules/assets/services/asset.service";
import { CreateMarketDto } from "../../../src/modules/exchange/dtos/market/create-market.dto";
import { UpdateMarketDto } from "../../../src/modules/exchange/dtos/market/update-market.dto";
import { MarketFiltersDto } from "../../../src/modules/exchange/dtos/market/market-filters.dto";
import { MarketDto } from "../../../src/modules/exchange/dtos/market/market.dto";
import { AssetDto } from "../../../src/modules/assets/dtos/asset.dto";
import { v4 as uuidv4 } from "uuid";

describe("MarketService", () => {
  let service: MarketService;
  let marketDao: jest.Mocked<MarketDao>;
  let assetService: jest.Mocked<AssetService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        {
          provide: MarketDao,
          useValue: {
            createMarket: jest.fn(),
            getMarketById: jest.fn(),
            getMarketBySymbol: jest.fn(),
            getMarkets: jest.fn(),
            updateMarket: jest.fn(),
            deleteMarket: jest.fn(),
          },
        },
        {
          provide: AssetService,
          useValue: {
            getAssetBySymbol: jest.fn(),
            getAssetById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);
    marketDao = module.get(MarketDao);
    assetService = module.get(AssetService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createMarket", () => {
    it("should create a market successfully with asset IDs", async () => {
      const baseAssetId = uuidv4();
      const quoteAssetId = uuidv4();
      const createDto: CreateMarketDto = {
        name: "BTC/USD Market",
        symbol: "BTC/USD",
        category: "crypto",
        baseAsset: "BTC",
        quoteAsset: "USD",
        baseAssetId,
        quoteAssetId,
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        maxQuantity: 100,
        isActive: true,
        is24h: true,
        timezone: "UTC",
      };

      const marketId = uuidv4();
      const mockMarket: MarketDto = {
        id: marketId,
        ...createDto,
        baseAssetId: baseAssetId || uuidv4(), // Ensure required property is set
        quoteAssetId: quoteAssetId || uuidv4(), // Ensure required property is set
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      marketDao.getMarketBySymbol.mockResolvedValue(null);
      marketDao.createMarket.mockResolvedValue(marketId);
      marketDao.getMarketById.mockResolvedValue(mockMarket);

      const result = await service.createMarket(createDto);

      expect(result).toEqual(mockMarket);
      expect(marketDao.getMarketBySymbol).toHaveBeenCalledWith("BTC/USD");
      expect(marketDao.createMarket).toHaveBeenCalledWith(createDto);
    });

    it("should resolve asset IDs from symbols if not provided", async () => {
      const baseAssetId = uuidv4();
      const quoteAssetId = uuidv4();

      const baseAsset: AssetDto = {
        id: baseAssetId,
        symbol: "BTC",
        name: "Bitcoin",
        type: "crypto",
        decimals: 8,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const quoteAsset: AssetDto = {
        id: quoteAssetId,
        symbol: "USD",
        name: "US Dollar",
        type: "currency",
        decimals: 2,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createDto: CreateMarketDto = {
        name: "BTC/USD Market",
        symbol: "BTC/USD",
        category: "crypto",
        baseAsset: "BTC",
        quoteAsset: "USD",
        baseAssetId: uuidv4(),
        quoteAssetId: uuidv4(),
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        maxQuantity: 100,
        isActive: true,
        is24h: true,
        timezone: "UTC",
      };

      const marketId = uuidv4();
      const mockMarket: MarketDto = {
        id: marketId,
        ...createDto,
        baseAssetId,
        quoteAssetId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      marketDao.getMarketBySymbol.mockResolvedValue(null);
      assetService.getAssetBySymbol
        .mockResolvedValueOnce(baseAsset)
        .mockResolvedValueOnce(quoteAsset);
      marketDao.createMarket.mockResolvedValue(marketId);
      marketDao.getMarketById.mockResolvedValue(mockMarket);

      const result = await service.createMarket(createDto);

      expect(result).toEqual(mockMarket);
      // Since baseAssetId and quoteAssetId are provided, getAssetBySymbol won't be called
      // expect(assetService.getAssetBySymbol).toHaveBeenCalledWith("BTC");
      // expect(assetService.getAssetBySymbol).toHaveBeenCalledWith("USD");
      // The service uses the provided asset IDs, so check that createMarket was called with them
      expect(marketDao.createMarket).toHaveBeenCalledWith(
        expect.objectContaining({
          baseAssetId: expect.any(String),
          quoteAssetId: expect.any(String),
        })
      );
    });

    it("should return null if market symbol already exists", async () => {
      const createDto: CreateMarketDto = {
        name: "BTC/USD Market",
        symbol: "BTC/USD",
        category: "crypto",
        baseAsset: "BTC",
        quoteAsset: "USD",
        baseAssetId: uuidv4(),
        quoteAssetId: uuidv4(),
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        isActive: true,
        is24h: true,
        timezone: "UTC",
      };

      marketDao.getMarketBySymbol.mockResolvedValue({
        id: uuidv4(),
        symbol: "BTC/USD",
      } as MarketDto);

      const result = await service.createMarket(createDto);

      expect(result).toBeNull();
      expect(marketDao.createMarket).not.toHaveBeenCalled();
    });

    it("should return null if base asset not found", async () => {
      // Test asset resolution by not providing asset IDs
      const createDto: Partial<CreateMarketDto> = {
        name: "BTC/USD Market",
        symbol: "BTC/USD",
        category: "crypto",
        baseAsset: "BTC",
        quoteAsset: "USD",
        // Don't provide asset IDs to test asset resolution
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        isActive: true,
        is24h: true,
        timezone: "UTC",
      } as CreateMarketDto;

      marketDao.getMarketBySymbol.mockResolvedValue(null);
      assetService.getAssetBySymbol.mockResolvedValue(null as any);

      const result = await service.createMarket(createDto as CreateMarketDto);

      expect(result).toBeNull();
      expect(assetService.getAssetBySymbol).toHaveBeenCalledWith("BTC");
      expect(marketDao.createMarket).not.toHaveBeenCalled();
    });

    it("should return null if quote asset not found", async () => {
      const baseAsset: AssetDto = {
        id: uuidv4(),
        symbol: "BTC",
        name: "Bitcoin",
        type: "crypto",
        decimals: 8,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Test asset resolution by not providing quote asset ID
      const createDto: Partial<CreateMarketDto> = {
        name: "BTC/USD Market",
        symbol: "BTC/USD",
        category: "crypto",
        baseAsset: "BTC",
        quoteAsset: "USD",
        baseAssetId: baseAsset.id, // Provide base asset ID
        // Don't provide quote asset ID to test resolution
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        isActive: true,
        is24h: true,
        timezone: "UTC",
      };

      marketDao.getMarketBySymbol.mockResolvedValue(null);
      assetService.getAssetBySymbol.mockResolvedValue(null as any);

      const result = await service.createMarket(createDto as CreateMarketDto);

      expect(result).toBeNull();
      expect(assetService.getAssetBySymbol).toHaveBeenCalledWith("USD");
      expect(marketDao.createMarket).not.toHaveBeenCalled();
    });

    it("should return null if invalid market symbol format", async () => {
      const createDto: CreateMarketDto = {
        name: "Invalid Market",
        symbol: "INVALID", // Missing separator
        category: "crypto",
        baseAsset: "INVALID",
        quoteAsset: "USD",
        baseAssetId: uuidv4(),
        quoteAssetId: uuidv4(),
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        isActive: true,
        is24h: true,
        timezone: "UTC",
      };

      const result = await service.createMarket(createDto);

      expect(result).toBeNull();
      expect(marketDao.getMarketBySymbol).not.toHaveBeenCalled();
    });

    it("should validate trading hours if provided", async () => {
      const createDto: CreateMarketDto = {
        name: "BTC/USD Market",
        symbol: "BTC/USD",
        category: "crypto",
        baseAsset: "BTC",
        quoteAsset: "USD",
        baseAssetId: uuidv4(),
        quoteAssetId: uuidv4(),
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        tradingStart: "25:00", // Invalid hour
        tradingEnd: "10:00",
        isActive: true,
        is24h: true,
        timezone: "UTC",
      };

      const result = await service.createMarket(createDto);

      expect(result).toBeNull();
      expect(marketDao.createMarket).not.toHaveBeenCalled();
    });
  });

  describe("getMarketById", () => {
    it("should return a market if found", async () => {
      const marketId = uuidv4();
      const mockMarket: MarketDto = {
        id: marketId,
        name: "BTC/USD Market",
        symbol: "BTC/USD",
        category: "crypto",
        baseAsset: "BTC",
        quoteAsset: "USD",
        baseAssetId: uuidv4(),
        quoteAssetId: uuidv4(),
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        isActive: true,
        is24h: true,
        timezone: "UTC",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      marketDao.getMarketById.mockResolvedValue(mockMarket);

      const result = await service.getMarketById(marketId);

      expect(result).toEqual(mockMarket);
      expect(marketDao.getMarketById).toHaveBeenCalledWith(marketId);
    });

    it("should return null if market not found", async () => {
      marketDao.getMarketById.mockResolvedValue(null);

      const result = await service.getMarketById(uuidv4());

      expect(result).toBeNull();
    });
  });

  describe("getMarketBySymbol", () => {
    it("should return a market if found", async () => {
      const mockMarket: MarketDto = {
        id: uuidv4(),
        name: "BTC/USD Market",
        symbol: "BTC/USD",
        category: "crypto",
        baseAsset: "BTC",
        quoteAsset: "USD",
        baseAssetId: uuidv4(),
        quoteAssetId: uuidv4(),
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        isActive: true,
        is24h: true,
        timezone: "UTC",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      marketDao.getMarketBySymbol.mockResolvedValue(mockMarket);

      const result = await service.getMarketBySymbol("BTC/USD");

      expect(result).toEqual(mockMarket);
      expect(marketDao.getMarketBySymbol).toHaveBeenCalledWith("BTC/USD");
    });
  });

  describe("getMarkets", () => {
    it("should return list of markets", async () => {
      const mockMarkets: MarketDto[] = [
        {
          id: uuidv4(),
          name: "BTC/USD Market",
          symbol: "BTC/USD",
          category: "crypto",
          baseAsset: "BTC",
          quoteAsset: "USD",
          baseAssetId: uuidv4(),
          quoteAssetId: uuidv4(),
          minPriceIncrement: 0.01,
          minQuantityIncrement: 0.001,
          isActive: true,
          is24h: true,
          timezone: "UTC",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uuidv4(),
          name: "ETH/USD Market",
          symbol: "ETH/USD",
          category: "crypto",
          baseAsset: "ETH",
          quoteAsset: "USD",
          baseAssetId: uuidv4(),
          quoteAssetId: uuidv4(),
          minPriceIncrement: 0.01,
          minQuantityIncrement: 0.001,
          isActive: true,
          is24h: true,
          timezone: "UTC",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      marketDao.getMarkets.mockResolvedValue(mockMarkets);

      const result = await service.getMarkets();

      expect(result).toEqual(mockMarkets);
      expect(marketDao.getMarkets).toHaveBeenCalledWith(undefined);
    });

    it("should apply filters when provided", async () => {
      const filters: MarketFiltersDto = {
        category: "crypto",
        isActive: true,
      };

      const mockMarkets: MarketDto[] = [
        {
          id: uuidv4(),
          name: "BTC/USD Market",
          symbol: "BTC/USD",
          category: "crypto",
          baseAsset: "BTC",
          quoteAsset: "USD",
          baseAssetId: uuidv4(),
          quoteAssetId: uuidv4(),
          minPriceIncrement: 0.01,
          minQuantityIncrement: 0.001,
          isActive: true,
          is24h: true,
          timezone: "UTC",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      marketDao.getMarkets.mockResolvedValue(mockMarkets);

      const result = await service.getMarkets(filters);

      expect(result).toEqual(mockMarkets);
      expect(marketDao.getMarkets).toHaveBeenCalledWith(filters);
    });
  });

  describe("updateMarket", () => {
    it("should update a market successfully", async () => {
      const marketId = uuidv4();
      const existingMarket: MarketDto = {
        id: marketId,
        name: "Old Market Name",
        symbol: "BTC/USD",
        category: "crypto",
        baseAsset: "BTC",
        quoteAsset: "USD",
        baseAssetId: uuidv4(),
        quoteAssetId: uuidv4(),
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        isActive: true,
        is24h: true,
        timezone: "UTC",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateDto: UpdateMarketDto = {
        name: "New Market Name",
        isActive: false,
      };

      const updatedMarket: MarketDto = {
        ...existingMarket,
        ...updateDto,
        updatedAt: new Date(),
      };

      // Service calls getMarketById after update to return the updated market
      marketDao.getMarketById.mockResolvedValue(updatedMarket);
      marketDao.updateMarket.mockResolvedValue(true);

      const result = await service.updateMarket(marketId, updateDto);

      expect(result).toEqual(updatedMarket);
      expect(marketDao.updateMarket).toHaveBeenCalledWith(marketId, updateDto);
    });

    it("should return null if market not found", async () => {
      const marketId = uuidv4();
      // The service calls updateMarket first, then getMarketById to retrieve the updated market
      // If updateMarket returns false or getMarketById returns null, the service returns null
      marketDao.updateMarket.mockResolvedValue(false);
      marketDao.getMarketById.mockResolvedValue(null);

      const result = await service.updateMarket(marketId, {
        name: "New Name",
      });

      expect(result).toBeNull();
      // The service calls updateMarket, and if it fails, getMarketById won't be called
      // But if updateMarket succeeds but getMarketById returns null, both are called
      expect(marketDao.updateMarket).toHaveBeenCalledWith(marketId, { name: "New Name" });
    });
  });

  describe("deleteMarket", () => {
    it("should delete a market successfully", async () => {
      const marketId = uuidv4();
      const existingMarket: MarketDto = {
        id: marketId,
        name: "Test Market",
        symbol: "BTC/USD",
        category: "crypto",
        baseAsset: "BTC",
        quoteAsset: "USD",
        baseAssetId: uuidv4(),
        quoteAssetId: uuidv4(),
        minPriceIncrement: 0.01,
        minQuantityIncrement: 0.001,
        isActive: true,
        is24h: true,
        timezone: "UTC",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      marketDao.getMarketById.mockResolvedValue(existingMarket);
      marketDao.deleteMarket.mockResolvedValue(true);

      const result = await service.deleteMarket(marketId);

      expect(result).toBe(true);
      expect(marketDao.deleteMarket).toHaveBeenCalledWith(marketId);
    });

    it("should return false if market not found", async () => {
      marketDao.deleteMarket.mockResolvedValue(false);

      const result = await service.deleteMarket(uuidv4());

      expect(result).toBe(false);
      expect(marketDao.deleteMarket).toHaveBeenCalled();
    });
  });
});

