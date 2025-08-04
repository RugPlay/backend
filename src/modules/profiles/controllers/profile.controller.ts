import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  SerializeOptions,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthGuard, Session, UserSession } from "@thallesp/nestjs-better-auth";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ProfileService } from "@/modules/profiles/services/profile.service";
import { ProfileDto } from "@/modules/profiles/dtos/profile.dto";
import { CreateProfileDto } from "@/modules/profiles/dtos/create-profile.dto";
import { UpdateProfileDto } from "@/modules/profiles/dtos/update-profile.dto";

@ApiTags("Profiles")
@Controller("Profiles")
export class ProfileController {
  constructor(private readonly ProfileService: ProfileService) {}

  @Get()
  @UseGuards(AuthGuard)
  async getProfiles(@Session() session: UserSession): Promise<any> {
    return { ...session };
  }

  @Post()
  @SerializeOptions({ type: ProfileDto })
  @ApiOperation({ summary: "Create a new Profile" })
  @ApiResponse({
    status: 201,
    description: "The Profile has been successfully created",
    type: ProfileDto,
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  async createProfile(@Body() data: CreateProfileDto): Promise<ProfileDto> {
    return this.ProfileService.createProfile(data);
  }

  @Get(":id")
  @SerializeOptions({ type: ProfileDto })
  @ApiOperation({ summary: "Get a Profile by ID" })
  @ApiResponse({
    status: 200,
    description: "The Profile has been successfully retrieved",
    type: ProfileDto,
  })
  @ApiResponse({ status: 404, description: "Profile not found" })
  async getProfileById(@Param("id") id: string): Promise<ProfileDto> {
    return this.ProfileService.getProfileById(id);
  }

  @Put(":id")
  @SerializeOptions({ type: ProfileDto })
  @ApiOperation({ summary: "Update a Profile" })
  @ApiResponse({
    status: 200,
    description: "The Profile has been successfully updated",
    type: ProfileDto,
  })
  @ApiResponse({ status: 404, description: "Profile not found" })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  async updateProfile(
    @Param("id") id: string,
    @Body() data: UpdateProfileDto,
  ): Promise<ProfileDto> {
    return this.ProfileService.updateProfile(id, data);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a Profile" })
  @ApiResponse({
    status: 204,
    description: "The Profile has been successfully deleted",
  })
  @ApiResponse({ status: 404, description: "Profile not found" })
  async deleteProfile(@Param("id") id: string): Promise<void> {
    await this.ProfileService.deleteProfile(id);
  }
}
