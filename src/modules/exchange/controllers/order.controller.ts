import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { OrderService } from "../services/order.service";
import { OrderBookDto } from "../dtos/order/order-book.dto";
import { OrderBookEntryDto } from "../dtos/order/order-book-entry.dto";
import { OrderMatchingResultDto } from "../dtos/order/order-matching-result.dto";
import { PlaceOrderDto } from "../dtos/order/place-order.dto";
import { MarketService } from "../services/market.service";
import { v4 as uuidv4 } from "uuid";
import {
  MarketNotFoundException,
  OrderOperationFailedException,
  OrderBookNotFoundException,
} from "../exceptions";

@ApiTags("Order")
@Controller("order")
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly marketService: MarketService,
  ) {}

  @Get("markets")
  @ApiOperation({ summary: "Get all market IDs" })
  @ApiResponse({
    status: 200,
    description: "List of all market IDs",
    type: [String],
  })
  async getMarketIds(): Promise<string[]> {
    return await this.orderService.getMarketIds();
  }

  @Get(":marketId")
  @ApiOperation({ summary: "Get order book for a specific market" })
  @ApiResponse({
    status: 200,
    description: "Order book data",
    type: OrderBookDto,
  })
  @ApiResponse({
    status: 404,
    description: "Market not found",
  })
  async getOrderBook(
    @Param("marketId") marketId: string,
  ): Promise<OrderBookDto> {
    // Check if market exists first
    const marketExists = await this.orderService.hasOrderBook(marketId);
    if (!marketExists) {
      throw new MarketNotFoundException(marketId);
    }

    const orderBook = await this.orderService.getOrderBook(marketId);
    return orderBook;
  }

  @Get(":marketId/best-bid")
  @ApiOperation({ summary: "Get best bid for a market" })
  @ApiResponse({
    status: 200,
    description: "Best bid order",
    type: OrderBookEntryDto,
  })
  @ApiResponse({
    status: 404,
    description: "No bids found",
  })
  async getBestBid(
    @Param("marketId") marketId: string,
  ): Promise<OrderBookEntryDto> {
    const bestBid = await this.orderService.getBestBid(marketId);
    if (!bestBid) {
      throw new OrderBookNotFoundException(
        `No bids found for market: ${marketId}`,
      );
    }
    return bestBid;
  }

  @Get(":marketId/best-ask")
  @ApiOperation({ summary: "Get best ask for a market" })
  @ApiResponse({
    status: 200,
    description: "Best ask order",
    type: OrderBookEntryDto,
  })
  @ApiResponse({
    status: 404,
    description: "No asks found",
  })
  async getBestAsk(
    @Param("marketId") marketId: string,
  ): Promise<OrderBookEntryDto> {
    const bestAsk = await this.orderService.getBestAsk(marketId);
    if (!bestAsk) {
      throw new OrderBookNotFoundException(
        `No asks found for market: ${marketId}`,
      );
    }
    return bestAsk;
  }

  @Get(":marketId/spread")
  @ApiOperation({ summary: "Get spread between best bid and ask" })
  @ApiResponse({
    status: 200,
    description: "Spread value",
    type: Number,
  })
  @ApiResponse({
    status: 404,
    description: "Cannot calculate spread",
  })
  async getSpread(
    @Param("marketId") marketId: string,
  ): Promise<{ spread: number }> {
    const spread = await this.orderService.getSpread(marketId);
    if (spread === null) {
      throw new OrderBookNotFoundException(
        `Cannot calculate spread for market: ${marketId}`,
      );
    }
    return { spread };
  }

  @Get(":marketId/depth/:levels")
  @ApiOperation({ summary: "Get order book depth" })
  @ApiResponse({
    status: 200,
    description: "Order book depth",
    schema: {
      type: "object",
      properties: {
        bids: {
          type: "array",
          items: { $ref: "#/components/schemas/OrderBookEntry" },
        },
        asks: {
          type: "array",
          items: { $ref: "#/components/schemas/OrderBookEntry" },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Market not found",
  })
  async getDepth(
    @Param("marketId") marketId: string,
    @Param("levels") levels: string,
  ): Promise<{ bids: OrderBookEntryDto[]; asks: OrderBookEntryDto[] }> {
    const depth = await this.orderService.getDepth(
      marketId,
      parseInt(levels, 10),
    );
    if (!depth) {
      throw new MarketNotFoundException(marketId);
    }
    return depth;
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
    type: PlaceOrderDto,
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
    @Body() orderRequest: PlaceOrderDto,
  ): Promise<OrderMatchingResultDto> {
    try {
      // Check if market exists using MarketService for more reliable check
      const market = await this.marketService.getMarketById(marketId);
      if (!market) {
        throw new MarketNotFoundException(marketId);
      }
      
      // Ensure order book is initialized for this market
      await this.orderService.initializeOrderBook(marketId);

      // Create order object (validation is handled by ValidationPipe via PlaceOrderDto)
      const order = {
        marketId,
        orderId: uuidv4(),
        side: orderRequest.side,
        price: orderRequest.price,
        quantity: orderRequest.quantity,
        userId: orderRequest.userId,
        quoteAssetId: orderRequest.quoteAssetId,
      };

      // Place order with matching
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
              userId: result.remainingOrder.userId,
              quoteAssetId: result.remainingOrder.quoteAssetId,
              timestamp: result.remainingOrder.timestamp,
              orderId: result.remainingOrder.orderId,
              side: result.remainingOrder.side,
            }
          : null,
        updatedOrders: result.updatedOrders,
        completedOrderIds: result.completedOrderIds,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new OrderOperationFailedException(
        "Internal server error during order placement",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(":marketId/:orderId")
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
        throw new OrderOperationFailedException("Missing required field: side");
      }

      // Check if market exists using MarketService for more reliable check
      const market = await this.marketService.getMarketById(marketId);
      if (!market) {
        throw new MarketNotFoundException(marketId);
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
        throw new OrderOperationFailedException(
          "Order not found or could not be cancelled",
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new OrderOperationFailedException(
        "Internal server error during order cancellation",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

}
