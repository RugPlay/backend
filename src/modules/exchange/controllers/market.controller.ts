import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpStatus,
  HttpException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { MarketService } from "../services/market.service";
import type { MarketCategory } from "../types/market-category";
import { MarketDto } from "../dtos/market/market.dto";
import { CreateMarketDto } from "../dtos/market/create-market.dto";
import { UpdateMarketDto } from "../dtos/market/update-market.dto";
import { MarketFiltersDto } from "../dtos/market/market-filters.dto";
import { TradeExecutionDto } from "../dtos/trade/trade-execution.dto";
import { OrderService } from "../services/order.service";
import {
  MarketNotFoundException,
  MarketOperationFailedException,
  OrderOperationFailedException,
} from "../exceptions";

@ApiTags("markets")
@Controller("markets")
export class MarketController {
  constructor(
    private readonly marketService: MarketService,
    private readonly orderService: OrderService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new market" })
  @ApiResponse({
    status: 201,
    description: "Market created successfully",
    type: MarketDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid market data or symbol already exists",
  })
  async createMarket(
    @Body() createMarketDto: CreateMarketDto,
  ): Promise<MarketDto> {
    const market = await this.marketService.createMarket(createMarketDto);
    if (!market) {
      throw new MarketOperationFailedException("create");
    }
    
    // Initialize order book for the new market
    await this.orderService.initializeOrderBook(market.id);
    
    return market;
  }

  @Get()
  @ApiOperation({ summary: "Get all markets with optional filters" })
  @ApiQuery({
    name: "category",
    required: false,
    enum: [
      "futures",
      "commodities",
      "forex",
      "crypto",
      "stocks",
      "indices",
      "bonds",
    ],
  })
  @ApiQuery({ name: "baseAssetId", required: false })
  @ApiQuery({ name: "quoteAssetId", required: false })
  @ApiQuery({ name: "isActive", required: false, type: Boolean })
  @ApiQuery({ name: "is24h", required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: "List of markets",
    type: [MarketDto],
  })
  async getMarkets(
    @Query("category") category?: MarketCategory,
    @Query("baseAssetId") baseAssetId?: string,
    @Query("quoteAssetId") quoteAssetId?: string,
    @Query("isActive") isActive?: boolean,
    @Query("is24h") is24h?: boolean,
  ): Promise<MarketDto[]> {
    const filters: MarketFiltersDto = {};
    if (category) filters.category = category;
    if (baseAssetId) filters.baseAssetId = baseAssetId;
    if (quoteAssetId) filters.quoteAssetId = quoteAssetId;
    if (isActive !== undefined) filters.isActive = isActive;
    if (is24h !== undefined) filters.is24h = is24h;

    return await this.marketService.getMarkets(filters);
  }

  @Get("active")
  @ApiOperation({ summary: "Get all active markets" })
  @ApiResponse({
    status: 200,
    description: "List of active markets",
    type: [MarketDto],
  })
  async getActiveMarkets(): Promise<MarketDto[]> {
    return await this.marketService.getActiveMarkets();
  }

  @Get("categories")
  @ApiOperation({ summary: "Get all market categories" })
  @ApiResponse({
    status: 200,
    description: "List of market categories",
    type: [String],
  })
  async getCategories(): Promise<MarketCategory[]> {
    return await this.marketService.getCategories();
  }

  @Get("category/:category")
  @ApiOperation({ summary: "Get markets by category" })
  @ApiParam({
    name: "category",
    enum: [
      "futures",
      "commodities",
      "forex",
      "crypto",
      "stocks",
      "indices",
      "bonds",
    ],
  })
  @ApiResponse({
    status: 200,
    description: "List of markets in the specified category",
    type: [MarketDto],
  })
  async getMarketsByCategory(
    @Param("category") category: MarketCategory,
  ): Promise<MarketDto[]> {
    return await this.marketService.getMarketsByCategory(category);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a market by ID" })
  @ApiParam({ name: "id", type: String })
  @ApiResponse({
    status: 200,
    description: "Market found",
    type: MarketDto,
  })
  @ApiResponse({
    status: 404,
    description: "Market not found",
  })
  async getMarketById(@Param("id") id: string): Promise<MarketDto> {
      const market = await this.marketService.getMarketById(id);
      if (!market) {
        throw new MarketNotFoundException(id);
      }
      return market;
  }

  @Get("symbol/:symbol")
  @ApiOperation({ summary: "Get a market by symbol" })
  @ApiParam({ name: "symbol", type: String })
  @ApiResponse({
    status: 200,
    description: "Market found",
    type: MarketDto,
  })
  @ApiResponse({
    status: 404,
    description: "Market not found",
  })
  async getMarketBySymbol(@Param("symbol") symbol: string): Promise<MarketDto> {
    const market = await this.marketService.getMarketBySymbol(symbol);
    if (!market) {
      throw new MarketNotFoundException(symbol);
    }
    return market;
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a market" })
  @ApiParam({ name: "id", type: String })
  @ApiResponse({
    status: 200,
    description: "Market updated successfully",
    type: MarketDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid market data",
  })
  @ApiResponse({
    status: 404,
    description: "Market not found",
  })
  async updateMarket(
    @Param("id") id: string,
    @Body() updateMarketDto: UpdateMarketDto,
  ): Promise<MarketDto> {
    const market = await this.marketService.updateMarket(id, updateMarketDto);
    if (!market) {
      throw new MarketOperationFailedException("update");
    }
    return market;
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a market" })
  @ApiParam({ name: "id", type: String })
  @ApiResponse({
    status: 200,
    description: "Market deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Market not found",
  })
  async deleteMarket(@Param("id") id: string): Promise<{ message: string }> {
    const deleted = await this.marketService.deleteMarket(id);
    if (!deleted) {
      throw new MarketNotFoundException(id);
    }
    return { message: "Market deleted successfully" };
  }

  @Get(":marketId/recent-trades")
  @ApiOperation({
    summary: "Get recent trades for a market",
    description:
      "Retrieves the most recent trade executions for a specific market",
  })
  @ApiParam({
    name: "marketId",
    description: "The unique identifier of the market",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "limit",
    description: "Maximum number of trades to return",
    required: false,
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: "Recent trades retrieved successfully",
    type: [TradeExecutionDto],
  })
  @ApiResponse({
    status: 404,
    description: "Market not found",
  })
  async getRecentTrades(
    @Param("marketId") marketId: string,
    @Query("limit") limit?: number,
  ): Promise<TradeExecutionDto[]> {
    try {
      // Check if market exists using MarketService for more reliable check
      const market = await this.marketService.getMarketById(marketId);
      if (!market) {
        throw new MarketNotFoundException(marketId);
      }

      const trades = await this.orderService.getRecentTrades(
        marketId,
        limit || 50,
      );

      return trades.map((trade) => ({
        tradeId: trade.tradeId,
        marketId: trade.marketId,
        takerOrderId: trade.takerOrderId,
        makerOrderId: trade.makerOrderId,
        takerSide: trade.takerSide,
        type: trade.type, // Ensure the 'type' property is included to match TradeExecutionDto
        quantity: trade.quantity,
        price: trade.price,
        timestamp: trade.timestamp || trade.createdAt,
        createdAt: trade.createdAt, // Include createdAt for backward compatibility
        takerUserId: trade.takerUserId,
        makerUserId: trade.makerUserId,
      }));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new OrderOperationFailedException(
        "Internal server error while retrieving trades",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(":marketId/stats")
  @ApiOperation({
    summary: "Get market statistics",
    description: "Retrieves comprehensive statistics for a market",
  })
  @ApiParam({
    name: "marketId",
    description: "The unique identifier of the market",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Market statistics retrieved successfully",
    schema: {
      type: "object",
      properties: {
        marketId: { type: "string" },
        totalVolume: { type: "number" },
        lastPrice: { type: "number" },
        priceChange24h: { type: "number" },
        high24h: { type: "number" },
        low24h: { type: "number" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Market not found",
  })
  async getMarketStats(
    @Param("marketId") marketId: string,
  ): Promise<{
    marketId: string;
    totalVolume: number;
    lastPrice: number | null;
    priceChange24h: number;
    high24h: number | null;
    low24h: number | null;
  }> {
    try {
      // Check if market exists using MarketService for more reliable check
      const market = await this.marketService.getMarketById(marketId);
      if (!market) {
        throw new MarketNotFoundException(marketId);
      }

      // Get basic stats (for now, return mock data - can be enhanced later)
      const lastPrice = await this.orderService.getLastTradePrice(marketId);
      const recentTrades = await this.orderService.getRecentTrades(marketId, 100);
      
      // Calculate basic statistics
      const totalVolume = recentTrades.reduce((sum, trade) => sum + (trade.price * trade.quantity), 0);
      const prices = recentTrades.map(trade => trade.price);
      const high24h = prices.length > 0 ? Math.max(...prices) : null;
      const low24h = prices.length > 0 ? Math.min(...prices) : null;

      return {
        marketId,
        totalVolume,
        lastPrice,
        priceChange24h: 0, // TODO: Calculate actual 24h change
        high24h,
        low24h,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new OrderOperationFailedException(
        "Internal server error while retrieving market stats",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(":marketId/trades")
  @ApiOperation({
    summary: "Get recent trades for a market (alias for recent-trades)",
    description: "Retrieves the most recent trade executions for a specific market",
  })
  @ApiParam({
    name: "marketId",
    description: "The unique identifier of the market",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "limit",
    description: "Maximum number of trades to return",
    required: false,
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: "Recent trades retrieved successfully",
    type: [TradeExecutionDto],
  })
  @ApiResponse({
    status: 404,
    description: "Market not found",
  })
  async getTrades(
    @Param("marketId") marketId: string,
    @Query("limit") limit?: number,
  ): Promise<TradeExecutionDto[]> {
    return this.getRecentTrades(marketId, limit);
  }

  @Get(":marketId/last-price")
  @ApiOperation({
    summary: "Get the last trade price for a market",
    description: "Retrieves the price of the most recent trade execution",
  })
  @ApiParam({
    name: "marketId",
    description: "The unique identifier of the market",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Last trade price retrieved successfully",
    schema: {
      type: "object",
      properties: {
        marketId: {
          type: "string",
          example: "123e4567-e89b-12d3-a456-426614174000",
        },
        lastPrice: {
          type: "number",
          example: 50000.5,
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Market not found or no trades available",
  })
  async getLastTradePrice(
    @Param("marketId") marketId: string,
  ): Promise<{ marketId: string; lastPrice: number | null }> {
    try {
      // Check if market exists using MarketService for more reliable check
      const market = await this.marketService.getMarketById(marketId);
      if (!market) {
        throw new MarketNotFoundException(marketId);
      }

      const lastPrice = await this.orderService.getLastTradePrice(marketId);

      return {
        marketId,
        lastPrice,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new OrderOperationFailedException(
        "Internal server error while retrieving last price",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

}
