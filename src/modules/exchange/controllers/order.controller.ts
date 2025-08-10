import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { OrderService } from "../services/order.service";
import { OrderBookDto } from "../dtos/order/order-book.dto";
import { OrderBookEntryDto } from "../dtos/order/order-book-entry.dto";

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
    const orderBook = await this.orderService.getOrderBook(marketId);
    if (!orderBook) {
      throw new HttpException(
        `Order book not found for market: ${marketId}`,
        HttpStatus.NOT_FOUND,
      );
    }
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
      throw new HttpException(
        `No bids found for market: ${marketId}`,
        HttpStatus.NOT_FOUND,
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
      throw new HttpException(
        `No asks found for market: ${marketId}`,
        HttpStatus.NOT_FOUND,
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
      throw new HttpException(
        `Cannot calculate spread for market: ${marketId}`,
        HttpStatus.NOT_FOUND,
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
      throw new HttpException(
        `Market not found: ${marketId}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return depth;
  }
}
