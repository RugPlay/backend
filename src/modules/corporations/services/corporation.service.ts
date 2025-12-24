import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CorporationDao } from "../daos/corporation.dao";
import { CreateCorporationDto } from "../dtos/create-corporation.dto";
import { UpdateCorporationDto } from "../dtos/update-corporation.dto";
import { CorporationFiltersDto } from "../dtos/corporation-filters.dto";
import { CorporationDto } from "../dtos/corporation.dto";

@Injectable()
export class CorporationService {
  private readonly logger = new Logger(CorporationService.name);

  constructor(private readonly corporationDao: CorporationDao) {}

  /**
   * Create a new corporation
   */
  async createCorporation(
    createDto: CreateCorporationDto
  ): Promise<CorporationDto> {
    this.logger.log(`Creating corporation: ${createDto.name}`);

    // Check if corporation with same name already exists
    const existing = await this.corporationDao.getCorporationByName(
      createDto.name
    );
    if (existing) {
      throw new BadRequestException(
        `Corporation with name ${createDto.name} already exists`
      );
    }

    const corporationId = await this.corporationDao.createCorporation(createDto);
    if (!corporationId) {
      throw new BadRequestException("Failed to create corporation");
    }

    const corporation = await this.corporationDao.getCorporationById(
      corporationId
    );
    if (!corporation) {
      throw new NotFoundException("Corporation not found after creation");
    }

    return corporation;
  }

  /**
   * Get a corporation by ID
   */
  async getCorporationById(id: string): Promise<CorporationDto> {
    const corporation = await this.corporationDao.getCorporationById(id);
    if (!corporation) {
      throw new NotFoundException(`Corporation with ID ${id} not found`);
    }
    return corporation;
  }

  /**
   * Get a corporation by name
   */
  async getCorporationByName(name: string): Promise<CorporationDto> {
    const corporation = await this.corporationDao.getCorporationByName(name);
    if (!corporation) {
      throw new NotFoundException(`Corporation with name ${name} not found`);
    }
    return corporation;
  }

  /**
   * Get all corporations with optional filters
   */
  async getCorporations(
    filters?: CorporationFiltersDto
  ): Promise<CorporationDto[]> {
    return this.corporationDao.getCorporations(filters);
  }

  /**
   * Get all active corporations
   */
  async getActiveCorporations(): Promise<CorporationDto[]> {
    return this.corporationDao.getActiveCorporations();
  }

  /**
   * Update a corporation
   */
  async updateCorporation(
    id: string,
    updateDto: UpdateCorporationDto
  ): Promise<CorporationDto> {
    this.logger.log(`Updating corporation: ${id}`);

    // Check if corporation exists
    const existing = await this.corporationDao.getCorporationById(id);
    if (!existing) {
      throw new NotFoundException(`Corporation with ID ${id} not found`);
    }

    // If updating name, check for conflicts
    if (updateDto.name && updateDto.name !== existing.name) {
      const nameConflict = await this.corporationDao.getCorporationByName(
        updateDto.name
      );
      if (nameConflict && nameConflict.id !== id) {
        throw new BadRequestException(
          `Corporation with name ${updateDto.name} already exists`
        );
      }
    }

    const success = await this.corporationDao.updateCorporation(id, updateDto);
    if (!success) {
      throw new BadRequestException("Failed to update corporation");
    }

    const updated = await this.corporationDao.getCorporationById(id);
    if (!updated) {
      throw new NotFoundException("Corporation not found after update");
    }

    return updated;
  }

  /**
   * Delete a corporation
   */
  async deleteCorporation(id: string): Promise<void> {
    this.logger.log(`Deleting corporation: ${id}`);

    const existing = await this.corporationDao.getCorporationById(id);
    if (!existing) {
      throw new NotFoundException(`Corporation with ID ${id} not found`);
    }

    const success = await this.corporationDao.deleteCorporation(id);
    if (!success) {
      throw new BadRequestException("Failed to delete corporation");
    }
  }
}

