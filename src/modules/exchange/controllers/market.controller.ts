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
import { v4 as uuidv4 } from "uuid";
import { OrderService } from "../services/order.service";
import { OrderMatchingResultDto } from "../dtos/order/order-matching-result.dto";

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
      throw new HttpException(
        "Failed to create market",
        HttpStatus.BAD_REQUEST,
      );
    }
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
  @ApiQuery({ name: "baseCurrency", required: false })
  @ApiQuery({ name: "quoteCurrency", required: false })
  @ApiQuery({ name: "isActive", required: false, type: Boolean })
  @ApiQuery({ name: "is24h", required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: "List of markets",
    type: [MarketDto],
  })
  async getMarkets(
    @Query("category") category?: MarketCategory,
    @Query("baseCurrency") baseCurrency?: string,
    @Query("quoteCurrency") quoteCurrency?: string,
    @Query("isActive") isActive?: boolean,
    @Query("is24h") is24h?: boolean,
  ): Promise<MarketDto[]> {
    const filters: MarketFiltersDto = {};
    if (category) filters.category = category;
    if (baseCurrency) filters.baseCurrency = baseCurrency;
    if (quoteCurrency) filters.quoteCurrency = quoteCurrency;
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
      throw new HttpException("Market not found", HttpStatus.NOT_FOUND);
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
      throw new HttpException("Market not found", HttpStatus.NOT_FOUND);
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
      throw new HttpException(
        "Failed to update market",
        HttpStatus.BAD_REQUEST,
      );
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
      throw new HttpException("Market not found", HttpStatus.NOT_FOUND);
    }
    return { message: "Market deleted successfully" };
  }

  @Post(":marketId/place-order")
  @ApiOperation({
    summary: "Place an order with automatic matching",
    description:
      "Places an order and attempts to match it against existing orders in the order book",
  })
  @ApiParam({
    name: "marketId",
    description: "The unique identifier of the market",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiBody({
    description: "Order details to place",
    schema: {
      type: "object",
      properties: {
        side: {
          type: "string",
          enum: ["bid", "ask"],
          description: "Order side (bid for buy, ask for sell)",
          example: "bid",
        },
        price: {
          type: "number",
          description: "Order price",
          example: 50000.5,
        },
        quantity: {
          type: "number",
          description: "Order quantity",
          example: 1.5,
        },
      },
      required: ["side", "price", "quantity"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Order placed and matching completed successfully",
    type: OrderMatchingResultDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid order parameters",
  })
  @ApiResponse({
    status: 404,
    description: "Market not found",
  })
  async placeOrderWithMatching(
    @Param("marketId") marketId: string,
    @Body()
    orderRequest: {
      side: "bid" | "ask";
      price: number;
      quantity: number;
      portfolioId: string;
    },
  ): Promise<OrderMatchingResultDto> {
    try {
      // Validate input
      if (!orderRequest.side || !orderRequest.price || !orderRequest.quantity) {
        throw new HttpException(
          "Missing required fields: side, price, quantity",
          HttpStatus.BAD_REQUEST,
        );
      }

      if (orderRequest.price <= 0 || orderRequest.quantity <= 0) {
        throw new HttpException(
          "Price and quantity must be positive numbers",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if market exists
      const marketExists = await this.orderService.hasOrderBook(marketId);
      if (!marketExists) {
        throw new HttpException(
          `Market ${marketId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Create order object
      const order = {
        marketId,
        orderId: uuidv4(),
        side: orderRequest.side,
        price: orderRequest.price,
        quantity: orderRequest.quantity,
        portfolioId: orderRequest.portfolioId,
      };

      // Place order with matching
      // Add missing portfolioId to order object for type compatibility
      const result = await this.orderService.addOrderWithMatching(
        marketId,
        order,
      );

      // Convert to DTO format
      return {
        matches: result.matches.map((match) => ({
          marketId: match.marketId,
          takerOrderId: match.takerOrderId,
          makerOrderId: match.makerOrderId,
          takerSide: match.takerSide,
          matchedQuantity: match.matchedQuantity,
          matchedPrice: match.matchedPrice,
          timestamp: match.timestamp,
          takerRemainingQuantity: match.takerRemainingQuantity,
          makerRemainingQuantity: match.makerRemainingQuantity,
        })),
        remainingOrder: result.remainingOrder
          ? {
              marketId: result.remainingOrder.marketId,
              price: result.remainingOrder.price,
              quantity: result.remainingOrder.quantity,
              portfolioId: result.remainingOrder.portfolioId,
              timestamp: result.remainingOrder.timestamp,
              orderId: result.remainingOrder.orderId,
              side: result.remainingOrder.side,
            }
          : undefined,
        updatedOrders: result.updatedOrders,
        completedOrderIds: result.completedOrderIds,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Internal server error during order placement",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
      // Check if market exists
      const marketExists = await this.orderService.hasOrderBook(marketId);
      if (!marketExists) {
        throw new HttpException(
          `Market ${marketId} not found`,
          HttpStatus.NOT_FOUND,
        );
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
        quantity: trade.quantity,
        price: trade.price,
        timestamp: trade.timestamp,
        takerUserId: trade.takerUserId,
        makerUserId: trade.makerUserId,
      }));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Internal server error while retrieving trades",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
      // Check if market exists
      const marketExists = await this.orderService.hasOrderBook(marketId);
      if (!marketExists) {
        throw new HttpException(
          `Market ${marketId} not found`,
          HttpStatus.NOT_FOUND,
        );
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
      throw new HttpException(
        "Internal server error while retrieving last price",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(":marketId/orders/:orderId")
  @ApiOperation({
    summary: "Cancel an order",
    description: "Cancels an existing order in the market",
  })
  @ApiParam({
    name: "marketId",
    description: "The unique identifier of the market",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "orderId",
    description: "The unique identifier of the order to cancel",
    example: "order-123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiBody({
    description: "Order cancellation details",
    schema: {
      type: "object",
      properties: {
        side: {
          type: "string",
          enum: ["bid", "ask"],
          description: "Order side (required for efficient cancellation)",
          example: "bid",
        },
      },
      required: ["side"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Order cancelled successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request or order not found",
  })
  @ApiResponse({
    status: 404,
    description: "Market not found",
  })
  async cancelOrder(
    @Param("marketId") marketId: string,
    @Param("orderId") orderId: string,
    @Body() body: { side: "bid" | "ask" },
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate input
      if (!body.side) {
        throw new HttpException(
          "Missing required field: side",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if market exists
      const marketExists = await this.orderService.hasOrderBook(marketId);
      if (!marketExists) {
        throw new HttpException(
          `Market ${marketId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Cancel the order
      const success = await this.orderService.removeOrder(
        marketId,
        orderId,
        body.side,
      );

      if (success) {
        return {
          success: true,
          message: "Order cancelled successfully",
        };
      } else {
        throw new HttpException(
          "Order not found or could not be cancelled",
          HttpStatus.BAD_REQUEST,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Internal server error during order cancellation",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
