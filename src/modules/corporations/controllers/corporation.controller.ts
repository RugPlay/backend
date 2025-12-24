import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { CorporationService } from "../services/corporation.service";
import { CreateCorporationDto } from "../dtos/create-corporation.dto";
import { UpdateCorporationDto } from "../dtos/update-corporation.dto";
import { CorporationFiltersDto } from "../dtos/corporation-filters.dto";
import { CorporationDto } from "../dtos/corporation.dto";

@ApiTags("Corporations")
@Controller("corporations")
export class CorporationController {
  constructor(private readonly corporationService: CorporationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new corporation" })
  @ApiResponse({
    status: 201,
    description: "Corporation created successfully",
    type: CorporationDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async createCorporation(
    @Body() createDto: CreateCorporationDto
  ): Promise<CorporationDto> {
    return this.corporationService.createCorporation(createDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all corporations with optional filters" })
  @ApiQuery({ name: "name", required: false })
  @ApiQuery({ name: "isActive", required: false })
  @ApiQuery({ name: "industry", required: false })
  @ApiResponse({
    status: 200,
    description: "List of corporations",
    type: [CorporationDto],
  })
  async getCorporations(
    @Query() filters: CorporationFiltersDto
  ): Promise<CorporationDto[]> {
    return this.corporationService.getCorporations(filters);
  }

  @Get("active")
  @ApiOperation({ summary: "Get all active corporations" })
  @ApiResponse({
    status: 200,
    description: "List of active corporations",
    type: [CorporationDto],
  })
  async getActiveCorporations(): Promise<CorporationDto[]> {
    return this.corporationService.getActiveCorporations();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a corporation by ID" })
  @ApiParam({ name: "id", description: "Corporation ID" })
  @ApiResponse({
    status: 200,
    description: "Corporation found",
    type: CorporationDto,
  })
  @ApiResponse({ status: 404, description: "Corporation not found" })
  async getCorporationById(@Param("id") id: string): Promise<CorporationDto> {
    return this.corporationService.getCorporationById(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a corporation" })
  @ApiParam({ name: "id", description: "Corporation ID" })
  @ApiResponse({
    status: 200,
    description: "Corporation updated successfully",
    type: CorporationDto,
  })
  @ApiResponse({ status: 404, description: "Corporation not found" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async updateCorporation(
    @Param("id") id: string,
    @Body() updateDto: UpdateCorporationDto
  ): Promise<CorporationDto> {
    return this.corporationService.updateCorporation(id, updateDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a corporation" })
  @ApiParam({ name: "id", description: "Corporation ID" })
  @ApiResponse({
    status: 204,
    description: "Corporation deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Corporation not found" })
  async deleteCorporation(@Param("id") id: string): Promise<void> {
    return this.corporationService.deleteCorporation(id);
  }
}

