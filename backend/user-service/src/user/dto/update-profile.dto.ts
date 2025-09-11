import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    example: 'John Doe Updated',
    description: 'The updated name of the user',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsNotEmpty({ message: 'Имя не может быть пустым' })
  @IsString()
  @MaxLength(100, { message: 'Имя не может быть длиннее 100 символов' })
  name?: string;

  // Note: Password update logic is more complex and might be handled
  // in a separate DTO/endpoint, e.g., ChangePasswordDto.
  // For now, only the name is updatable as per the basic profile requirements.
}
