import { ProfileDto } from "@/modules/profiles/dtos/profile.dto";
import { OmitType } from "@nestjs/mapped-types";

export class CreateProfileDto extends OmitType(ProfileDto, ["id"] as const) {}
