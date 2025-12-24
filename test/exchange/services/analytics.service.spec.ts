import { Test, TestingModule } from "@nestjs/testing";
import { AnalyticsService } from "../../../src/modules/exchange/services/analytics.service";
import { AnalyticsDao } from "../../../src/modules/exchange/daos/analytics.dao";
import { TimeBucketInterval, TimeBucketQueryDto } from "../../../src/modules/exchange/dtos/analytics/time-bucket.dto";
import { v4 as uuidv4 } from "uuid";

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let analyticsDao: jest.Mocked<AnalyticsDao>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: AnalyticsDao,
          useValue: {
            getOhlcData: jest.fn(),
            getVolumeData: jest.fn(),
            getPriceChangeData: jest.fn(),
            getLatestPrice: jest.fn(),
            get24HourStats: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    analyticsDao = module.get(AnalyticsDao);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getOhlcData", () => {
    it("should return OHLC data for a market", async () => {
      const marketId = uuidv4();
      const query: TimeBucketQueryDto = {
        marketId,
        interval: TimeBucketInterval.ONE_HOUR,
      };

      const mockOHLCData = [
        {
          timestamp: new Date(),
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          volume: 1000,
        },
        {
          timestamp: new Date(),
          open: 105,
          high: 115,
          low: 100,
          close: 110,
          volume: 1500,
        },
      ];

      analyticsDao.getOhlcData.mockResolvedValue(mockOHLCData as any);

      const result = await service.getOhlcData(query);

      expect(result).toEqual(mockOHLCData);
      expect(analyticsDao.getOhlcData).toHaveBeenCalledWith(
        query.marketId,
        query.interval,
        query.startTime,
        query.endTime,
        query.limit
      );
    });

    it("should handle different time bucket intervals", async () => {
      const marketId = uuidv4();
      const intervals = [
        TimeBucketInterval.ONE_MINUTE,
        TimeBucketInterval.FIVE_MINUTES,
        TimeBucketInterval.ONE_HOUR,
        TimeBucketInterval.ONE_DAY,
      ];

      for (const interval of intervals) {
        analyticsDao.getOhlcData.mockResolvedValue([]);
        await service.getOhlcData({ marketId, interval });
        expect(analyticsDao.getOhlcData).toHaveBeenCalledWith(
          marketId,
          interval,
          undefined,
          undefined,
          undefined
        );
      }
    });
  });

  describe("getVolumeData", () => {
    it("should return volume data for a market", async () => {
      const marketId = uuidv4();
      const query: TimeBucketQueryDto = {
        marketId,
        interval: TimeBucketInterval.ONE_HOUR,
      };

      const mockVolumeData = [
        {
          timestamp: new Date(),
          volume: 1000,
          buyVolume: 600,
          sellVolume: 400,
        },
        {
          timestamp: new Date(),
          volume: 1500,
          buyVolume: 900,
          sellVolume: 600,
        },
      ];

      analyticsDao.getVolumeData.mockResolvedValue(mockVolumeData as any);

      const result = await service.getVolumeData(query);

      expect(result).toEqual(mockVolumeData);
      expect(analyticsDao.getVolumeData).toHaveBeenCalledWith(
        query.marketId,
        query.interval,
        query.startTime,
        query.endTime,
        query.limit
      );
    });
  });

  describe("getPriceChangeData", () => {
    it("should return price change data for a market", async () => {
      const marketId = uuidv4();
      const query: TimeBucketQueryDto = {
        marketId,
        interval: TimeBucketInterval.ONE_HOUR,
      };

      const mockPriceChangeData = [
        {
          timestamp: new Date(),
          price: 105,
          change: 5,
          changePercent: 5.0,
        },
      ];

      analyticsDao.getPriceChangeData.mockResolvedValue(
        mockPriceChangeData as any
      );

      const result = await service.getPriceChangeData(query);

      expect(result).toEqual(mockPriceChangeData);
      expect(analyticsDao.getPriceChangeData).toHaveBeenCalledWith(
        query.marketId,
        query.interval,
        query.startTime,
        query.endTime,
        query.limit
      );
    });
  });

  describe("getLatestPrice", () => {
    it("should return latest price for a market", async () => {
      const marketId = uuidv4();
      const mockPrice = 105.5;

      analyticsDao.getLatestPrice.mockResolvedValue(mockPrice);

      const result = await service.getLatestPrice(marketId);

      expect(result).toBe(mockPrice);
      expect(analyticsDao.getLatestPrice).toHaveBeenCalledWith(marketId);
    });

    it("should return null if no price found", async () => {
      const marketId = uuidv4();

      analyticsDao.getLatestPrice.mockResolvedValue(null);

      const result = await service.getLatestPrice(marketId);

      expect(result).toBeNull();
    });
  });

  describe("get24HourStats", () => {
    it("should return 24-hour statistics for a market", async () => {
      const marketId = uuidv4();
      const mockStats = {
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 10000,
        tradeCount: 150,
        change: 5,
        changePercent: 5.0,
      };

      analyticsDao.get24HourStats.mockResolvedValue(mockStats);

      const result = await service.get24HourStats(marketId);

      expect(result).toEqual(mockStats);
      expect(analyticsDao.get24HourStats).toHaveBeenCalledWith(marketId);
    });

    it("should return null if no stats found", async () => {
      const marketId = uuidv4();

      analyticsDao.get24HourStats.mockResolvedValue(null);

      const result = await service.get24HourStats(marketId);

      expect(result).toBeNull();
    });
  });
});

