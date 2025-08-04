import { ProfileDto } from "@/modules/profiles/dtos/profile.dto";
import { OmitType, PartialType } from "@nestjs/mapped-types";

export class UpdateProfileDto extends PartialType(
  OmitType(ProfileDto, ["id"] as const),
) {}
