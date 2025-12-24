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
import { AddProductionTimeDto } from "../dtos/add-production-time.dto";
import { ClaimOutputDto } from "../dtos/claim-output.dto";
import { ClaimOutputResultDto } from "../dtos/claim-output-result.dto";
import { BusinessProductionProgressDto } from "../dtos/business-production-progress.dto";

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

  @Get(":id/instance")
  @ApiOperation({
    summary: "Get a business instance",
    description:
      "Returns a business instance with type-specific configuration and behavior",
  })
  @ApiParam({ name: "id", description: "Business ID" })
  @ApiResponse({
    status: 200,
    description: "Business instance found",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        type: { type: "string" },
        businessData: { $ref: "#/components/schemas/BusinessDto" },
        config: {
          type: "object",
          properties: {
            baseProductionRate: { type: "number" },
            defaultProductionTime: { type: "number" },
            displayName: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Business not found" })
  async getBusinessInstance(@Param("id") id: string): Promise<{
    id: string;
    name: string;
    type: string;
    businessData: BusinessDto;
    config: any;
  }> {
    const businessInstance =
      await this.businessService.getBusinessInstance(id);
    return {
      id: businessInstance.getId(),
      name: businessInstance.getName(),
      type: businessInstance.getType(),
      businessData: businessInstance.getBusinessData(),
      config: businessInstance.getConfig(),
    };
  }

  @Get("types/supported")
  @ApiOperation({
    summary: "Get all supported business types",
    description: "Returns a list of all supported business types",
  })
  @ApiResponse({
    status: 200,
    description: "List of supported business types",
    schema: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "agriculture",
          "mining",
          "industry_manufacturing",
          "industry_technology",
          "industry_healthcare",
          "heavy_industry",
          "power",
          "logistics",
          "commerce",
        ],
      },
    },
  })
  async getSupportedBusinessTypes(): Promise<string[]> {
    return this.businessService.getSupportedBusinessTypes();
  }

  @Post(":id/production/time")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Add production time to a business",
    description:
      "Adds time to a business's production accumulator. This time is used to calculate available outputs.",
  })
  @ApiParam({ name: "id", description: "Business ID" })
  @ApiResponse({
    status: 200,
    description: "Production time added successfully",
    type: BusinessProductionProgressDto,
  })
  @ApiResponse({ status: 404, description: "Business not found" })
  async addProductionTime(
    @Param("id") id: string,
    @Body() addTimeDto: AddProductionTimeDto
  ): Promise<BusinessProductionProgressDto> {
    return this.businessService.addProductionTime(id, addTimeDto);
  }

  @Get(":id/production/progress")
  @ApiOperation({
    summary: "Get production progress for a business",
    description:
      "Returns the current production progress including accumulated time and available outputs",
  })
  @ApiParam({ name: "id", description: "Business ID" })
  @ApiResponse({
    status: 200,
    description: "Production progress retrieved successfully",
    type: BusinessProductionProgressDto,
  })
  @ApiResponse({ status: 404, description: "Business not found" })
  async getProductionProgress(
    @Param("id") id: string
  ): Promise<BusinessProductionProgressDto> {
    return this.businessService.getProductionProgress(id);
  }

  @Post(":id/production/claim")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Claim business outputs",
    description:
      "Claims available outputs from a business. Consumes required inputs and adds outputs to corporation holdings.",
  })
  @ApiParam({ name: "id", description: "Business ID" })
  @ApiResponse({
    status: 200,
    description: "Outputs claimed successfully",
    type: ClaimOutputResultDto,
  })
  @ApiResponse({ status: 404, description: "Business or output not found" })
  @ApiResponse({
    status: 400,
    description: "Cannot claim: insufficient inputs or cycles",
  })
  async claimOutput(
    @Param("id") id: string,
    @Body() claimDto: ClaimOutputDto
  ): Promise<ClaimOutputResultDto> {
    return this.businessService.claimOutput(id, claimDto);
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

