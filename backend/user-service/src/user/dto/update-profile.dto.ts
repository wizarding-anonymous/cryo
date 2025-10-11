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

  // Note: Password operations are handled by Auth Service.
  // User Service only manages user profile data (name, etc.).
}
