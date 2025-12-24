import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { BusinessDao } from "../daos/business.dao";
import { CorporationDao } from "@/modules/corporations/daos/corporation.dao";
import { CreateBusinessDto } from "../dtos/create-business.dto";
import { UpdateBusinessDto } from "../dtos/update-business.dto";
import { BusinessFiltersDto } from "../dtos/business-filters.dto";
import { BusinessDto } from "../dtos/business.dto";

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    private readonly businessDao: BusinessDao,
    private readonly corporationDao: CorporationDao
  ) {}

  /**
   * Create a new business
   */
  async createBusiness(
    createDto: CreateBusinessDto
  ): Promise<BusinessDto> {
    this.logger.log(`Creating business: ${createDto.name}`);

    // Validate corporation exists
    const corporation = await this.corporationDao.getCorporationById(
      createDto.corporationId
    );
    if (!corporation) {
      throw new NotFoundException(
        `Corporation with ID ${createDto.corporationId} not found`
      );
    }

    // Check if business with same name already exists
    const existing = await this.businessDao.getBusinessByName(createDto.name);
    if (existing) {
      throw new BadRequestException(
        `Business with name ${createDto.name} already exists`
      );
    }

    const businessId = await this.businessDao.createBusiness(createDto);
    if (!businessId) {
      throw new BadRequestException("Failed to create business");
    }

    const business = await this.businessDao.getBusinessById(businessId);
    if (!business) {
      throw new NotFoundException("Business not found after creation");
    }

    return business;
  }

  /**
   * Get a business by ID
   */
  async getBusinessById(id: string): Promise<BusinessDto> {
    const business = await this.businessDao.getBusinessById(id);
    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }
    return business;
  }

  /**
   * Get a business by name
   */
  async getBusinessByName(name: string): Promise<BusinessDto> {
    const business = await this.businessDao.getBusinessByName(name);
    if (!business) {
      throw new NotFoundException(`Business with name ${name} not found`);
    }
    return business;
  }

  /**
   * Get all businesses with optional filters
   */
  async getBusinesses(
    filters?: BusinessFiltersDto
  ): Promise<BusinessDto[]> {
    return this.businessDao.getBusinesses(filters);
  }

  /**
   * Get all active businesses
   */
  async getActiveBusinesses(): Promise<BusinessDto[]> {
    return this.businessDao.getActiveBusinesses();
  }

  /**
   * Update a business
   */
  async updateBusiness(
    id: string,
    updateDto: UpdateBusinessDto
  ): Promise<BusinessDto> {
    this.logger.log(`Updating business: ${id}`);

    // Check if business exists
    const existing = await this.businessDao.getBusinessById(id);
    if (!existing) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    // If updating corporation, validate it exists
    if (updateDto.corporationId && updateDto.corporationId !== existing.corporationId) {
      const corporation = await this.corporationDao.getCorporationById(
        updateDto.corporationId
      );
      if (!corporation) {
        throw new NotFoundException(
          `Corporation with ID ${updateDto.corporationId} not found`
        );
      }
    }

    // If updating name, check for conflicts
    if (updateDto.name && updateDto.name !== existing.name) {
      const nameConflict = await this.businessDao.getBusinessByName(
        updateDto.name
      );
      if (nameConflict && nameConflict.id !== id) {
        throw new BadRequestException(
          `Business with name ${updateDto.name} already exists`
        );
      }
    }

    const success = await this.businessDao.updateBusiness(id, updateDto);
    if (!success) {
      throw new BadRequestException("Failed to update business");
    }

    const updated = await this.businessDao.getBusinessById(id);
    if (!updated) {
      throw new NotFoundException("Business not found after update");
    }

    return updated;
  }

  /**
   * Delete a business
   */
  async deleteBusiness(id: string): Promise<void> {
    this.logger.log(`Deleting business: ${id}`);

    const existing = await this.businessDao.getBusinessById(id);
    if (!existing) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }

    const success = await this.businessDao.deleteBusiness(id);
    if (!success) {
      throw new BadRequestException("Failed to delete business");
    }
  }
}

