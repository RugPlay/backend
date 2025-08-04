import { ApiProperty } from "@nestjs/swagger";

export class ProfileDto {
  @ApiProperty({
    description: "The unique identifier of the profile",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "The identity ID of the user",
    example: "auth0|123456789",
  })
  identity_id: string;

  @ApiProperty({
    description: "The timestamp when the profile was created",
    example: "2024-03-20T12:00:00Z",
  })
  created_at: Date;

  @ApiProperty({
    description: "The timestamp when the profile was last updated",
    example: "2024-03-20T12:00:00Z",
  })
  updated_at: Date;
}
