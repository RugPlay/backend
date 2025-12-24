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
import { BusinessService } from "../services/business.service";
import { CreateBusinessDto } from "../dtos/create-business.dto";
import { UpdateBusinessDto } from "../dtos/update-business.dto";
import { BusinessFiltersDto } from "../dtos/business-filters.dto";
import { BusinessDto } from "../dtos/business.dto";

@ApiTags("Businesses")
@Controller("businesses")
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new business" })
  @ApiResponse({
    status: 201,
    description: "Business created successfully",
    type: BusinessDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async createBusiness(
    @Body() createDto: CreateBusinessDto
  ): Promise<BusinessDto> {
    return this.businessService.createBusiness(createDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all businesses with optional filters" })
  @ApiQuery({ name: "name", required: false })
  @ApiQuery({ name: "isActive", required: false })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "corporationId", required: false })
  @ApiResponse({
    status: 200,
    description: "List of businesses",
    type: [BusinessDto],
  })
  async getBusinesses(
    @Query() filters: BusinessFiltersDto
  ): Promise<BusinessDto[]> {
    return this.businessService.getBusinesses(filters);
  }

  @Get("active")
  @ApiOperation({ summary: "Get all active businesses" })
  @ApiResponse({
    status: 200,
    description: "List of active businesses",
    type: [BusinessDto],
  })
  async getActiveBusinesses(): Promise<BusinessDto[]> {
    return this.businessService.getActiveBusinesses();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a business by ID" })
  @ApiParam({ name: "id", description: "Business ID" })
  @ApiResponse({
    status: 200,
    description: "Business found",
    type: BusinessDto,
  })
  @ApiResponse({ status: 404, description: "Business not found" })
  async getBusinessById(@Param("id") id: string): Promise<BusinessDto> {
    return this.businessService.getBusinessById(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a business" })
  @ApiParam({ name: "id", description: "Business ID" })
  @ApiResponse({
    status: 200,
    description: "Business updated successfully",
    type: BusinessDto,
  })
  @ApiResponse({ status: 404, description: "Business not found" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async updateBusiness(
    @Param("id") id: string,
    @Body() updateDto: UpdateBusinessDto
  ): Promise<BusinessDto> {
    return this.businessService.updateBusiness(id, updateDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a business" })
  @ApiParam({ name: "id", description: "Business ID" })
  @ApiResponse({
    status: 204,
    description: "Business deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Business not found" })
  async deleteBusiness(@Param("id") id: string): Promise<void> {
    return this.businessService.deleteBusiness(id);
  }
}

