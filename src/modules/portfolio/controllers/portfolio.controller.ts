import {
  Controller,
  Get,
  Param,
  Request,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { PortfolioService } from "../services/portfolio.service";
import { PortfolioDto } from "../dtos/portfolio.dto";
import { HoldingDto } from "../dtos/holding.dto";
import { BalanceDto } from "../dtos/balance.dto";

@ApiTags("portfolio")
@Controller("portfolio")
@ApiBearerAuth()
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  @ApiOperation({ summary: "Get the authenticated user's complete portfolio" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Portfolio retrieved successfully",
    type: PortfolioDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Portfolio not found",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User not authenticated",
  })
  async getPortfolio(@Request() req: any): Promise<PortfolioDto> {
    const userId = req.session.user.id;
    return this.portfolioService.getPortfolio(userId);
  }

  @Get("balance")
  @ApiOperation({ summary: "Get the authenticated user's balance only" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Balance retrieved successfully",
    type: BalanceDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Portfolio not found",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User not authenticated",
  })
  async getBalance(@Request() req: any): Promise<BalanceDto> {
    const userId = req.session.user.id;
    return this.portfolioService.getBalance(userId);
  }

  @Get("holdings")
  @ApiOperation({ summary: "Get the authenticated user's holdings" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Holdings retrieved successfully",
    type: [HoldingDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User not authenticated",
  })
  async getHoldings(@Request() req: any): Promise<HoldingDto[]> {
    const userId = req.session.user.id;
    return this.portfolioService.getHoldings(userId);
  }

  @Get("holdings/:marketId")
  @ApiOperation({ summary: "Get a specific holding by market ID" })
  @ApiParam({
    name: "marketId",
    description: "The market ID to get holding for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Holding retrieved successfully",
    type: HoldingDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Holding not found",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "User not authenticated",
  })
  async getHolding(
    @Request() req: any,
    @Param("marketId") marketId: string,
  ): Promise<HoldingDto | null> {
    const userId = req.session.user.id;
    return this.portfolioService.getHolding(userId, marketId);
  }
}
