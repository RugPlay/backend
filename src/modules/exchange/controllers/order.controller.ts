import {
  Controller,
  Get,
  Delete,
  Param,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { OrderService } from "../services/order.service";
import { OrderBookDto } from "../dtos/order/order-book.dto";
import { OrderBookEntryDto } from "../dtos/order/order-book-entry.dto";
import {
  MarketNotFoundException,
  OrderOperationFailedException,
  OrderBookNotFoundException,
} from "../exceptions";

@ApiTags("Order")
@Controller("order")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

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

  @Delete(":marketId/clear")
  @ApiOperation({ summary: "Clear order book for a market" })
  @ApiResponse({
    status: 200,
    description: "Order book cleared successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Market not found",
  })
  async clearOrderBook(
    @Param("marketId") marketId: string,
  ): Promise<{ message: string }> {
    await this.orderService.clearOrderBook(marketId);
    return { message: `Order book cleared for market ${marketId}` };
  }
}
