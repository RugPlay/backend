import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PortfolioDao } from "../daos/portfolio.dao";
import { HoldingDao } from "../daos/holding.dao";
import { CreatePortfolioDto } from "../dtos/create-portfolio.dto";
import { UpdateBalanceDto } from "../dtos/update-balance.dto";
import { PortfolioDto } from "../dtos/portfolio.dto";
import { HoldingDto } from "../dtos/holding.dto";
import { BalanceDto } from "../dtos/balance.dto";

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly portfolioDao: PortfolioDao,
    private readonly holdingDao: HoldingDao,
  ) {}

  /**
   * Create a new portfolio for a user
   */
  async createPortfolio(
    userId: string,
    createDto: CreatePortfolioDto,
  ): Promise<PortfolioDto> {
    this.logger.log(`Creating portfolio for user: ${userId}`);

    // Check if portfolio already exists
    const existingPortfolio =
      await this.portfolioDao.getPortfolioByUserId(userId);
    if (existingPortfolio) {
      throw new BadRequestException("Portfolio already exists for this user");
    }

    const portfolioId = await this.portfolioDao.createPortfolio(
      userId,
      createDto,
    );
    if (!portfolioId) {
      throw new BadRequestException("Failed to create portfolio");
    }

    return this.getPortfolio(userId);
  }

  /**
   * Get a user's complete portfolio
   */
  async getPortfolio(userId: string): Promise<PortfolioDto> {
    const portfolioData = await this.portfolioDao.getPortfolioByUserId(userId);
    if (!portfolioData) {
      throw new NotFoundException("Portfolio not found");
    }

    const holdings = await this.holdingDao.getHoldingsWithMarketByPortfolioId(
      portfolioData.id!,
    );

    return {
      id: portfolioData.id!,
      userId: portfolioData.userId!,
      balance: portfolioData.balance!,
      type: portfolioData.type || "real",
      holdings,
      createdAt: portfolioData.createdAt!,
      updatedAt: portfolioData.updatedAt!,
    };
  }

  /**
   * Get a user's balance only
   */
  async getBalance(userId: string): Promise<BalanceDto> {
    const portfolioData = await this.portfolioDao.getPortfolioByUserId(userId);
    if (!portfolioData) {
      throw new NotFoundException("Portfolio not found");
    }

    return {
      userId: portfolioData.userId!,
      balance: portfolioData.balance!,
      updatedAt: portfolioData.updatedAt!,
    };
  }

  /**
   * Update a user's balance
   */
  async updateBalance(
    userId: string,
    updateDto: UpdateBalanceDto,
  ): Promise<BalanceDto> {
    this.logger.log(
      `Updating balance for user: ${userId} to ${updateDto.balance}`,
    );

    if (updateDto.balance < 0) {
      throw new BadRequestException("Balance cannot be negative");
    }

    const success = await this.portfolioDao.updateBalance(
      userId,
      updateDto.balance,
    );
    if (!success) {
      throw new NotFoundException("Portfolio not found or update failed");
    }

    return this.getBalance(userId);
  }

  /**
   * Add or subtract from a user's balance
   */
  async adjustBalance(userId: string, amount: number): Promise<BalanceDto> {
    this.logger.log(`Adjusting balance for user: ${userId} by ${amount}`);

    // Check current balance to ensure we don't go negative
    const currentBalance = await this.portfolioDao.getBalance(userId);
    if (currentBalance === null) {
      throw new NotFoundException("Portfolio not found");
    }

    const newBalance = currentBalance + amount;
    if (newBalance < 0) {
      throw new BadRequestException("Insufficient balance");
    }

    const success = await this.portfolioDao.adjustBalance(userId, amount);
    if (!success) {
      throw new BadRequestException("Failed to adjust balance");
    }

    return this.getBalance(userId);
  }

  /**
   * Get user's holdings only
   */
  async getHoldings(userId: string): Promise<HoldingDto[]> {
    const portfolioData = await this.portfolioDao.getPortfolioByUserId(userId);
    if (!portfolioData) {
      throw new NotFoundException("Portfolio not found");
    }

    return this.holdingDao.getHoldingsWithMarketByPortfolioId(
      portfolioData.id!,
    );
  }

  /**
   * Get a specific holding by user and market
   */
  async getHolding(
    userId: string,
    marketId: string,
  ): Promise<HoldingDto | null> {
    const portfolioData = await this.portfolioDao.getPortfolioByUserId(userId);
    if (!portfolioData) {
      throw new NotFoundException("Portfolio not found");
    }

    const holdingData = await this.holdingDao.getHolding(
      portfolioData.id!,
      marketId,
    );
    if (!holdingData) {
      return null;
    }

    return {
      id: holdingData.id!,
      portfolioId: holdingData.portfolioId!,
      marketId: holdingData.marketId!,
      quantity: holdingData.quantity!,
      createdAt: holdingData.createdAt!,
      updatedAt: holdingData.updatedAt!,
    };
  }

  /**
   * Initialize a portfolio for a new user with default balance
   */
  async initializePortfolio(
    userId: string,
    initialBalance: number = 10000,
  ): Promise<PortfolioDto> {
    this.logger.log(
      `Initializing portfolio for user: ${userId} with balance: ${initialBalance}`,
    );

    // Check if portfolio already exists
    const existingPortfolio =
      await this.portfolioDao.getPortfolioByUserId(userId);
    if (existingPortfolio) {
      return this.getPortfolio(userId);
    }

    const createDto: CreatePortfolioDto = { balance: initialBalance, type: "real" };
    return this.createPortfolio(userId, createDto);
  }

  /**
   * Update a holding quantity for a user
   */
  async updateHolding(
    userId: string,
    marketId: string,
    quantity: number,
  ): Promise<boolean> {
    const portfolioData = await this.portfolioDao.getPortfolioByUserId(userId);
    if (!portfolioData) {
      throw new NotFoundException("Portfolio not found");
    }

    return this.holdingDao.upsertHolding(portfolioData.id!, marketId, quantity);
  }

  /**
   * Set a holding quantity to a specific value for a user
   */
  async setHoldingQuantity(
    userId: string,
    marketId: string,
    quantity: number,
  ): Promise<boolean> {
    const portfolioData = await this.portfolioDao.getPortfolioByUserId(userId);
    if (!portfolioData) {
      throw new NotFoundException("Portfolio not found");
    }

    return this.holdingDao.setHoldingQuantity(
      portfolioData.id!,
      marketId,
      quantity,
    );
  }

  /**
   * Adjust a holding quantity by a delta amount for a user
   */
  async adjustHoldingQuantity(
    userId: string,
    marketId: string,
    deltaQuantity: number,
  ): Promise<boolean> {
    const portfolioData = await this.portfolioDao.getPortfolioByUserId(userId);
    if (!portfolioData) {
      throw new NotFoundException("Portfolio not found");
    }

    return this.holdingDao.adjustHoldingQuantity(
      portfolioData.id!,
      marketId,
      deltaQuantity,
    );
  }
}
