import { ApiProperty } from '@nestjs/swagger';

export class UploadAvatarDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'Avatar image file (max 5MB, supported formats: jpg, jpeg, png, gif)',
  })
  avatar: Express.Multer.File;
}

export class AvatarResponseDto {
  @ApiProperty({
    example: 'https://example.com/avatars/user-123.jpg',
    description: 'URL of the uploaded avatar',
  })
  avatarUrl: string;

  @ApiProperty({
    example: 'Avatar uploaded successfully',
    description: 'Success message',
  })
  message: string;
}
