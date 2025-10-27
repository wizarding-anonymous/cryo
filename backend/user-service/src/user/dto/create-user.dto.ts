import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * This DTO is used internally by the UserService to create a new user.
 * It is separate from registration DTOs to decouple user management.
 * The password field should contain an already hashed password.
 */
export class CreateUserDto {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  @MaxLength(100, { message: 'Name cannot be longer than 100 characters' })
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be valid' })
  @MaxLength(255, { message: 'Email cannot be longer than 255 characters' })
  email: string;

  @ApiProperty({
    description: 'Pre-hashed password from calling service',
    example: '$2b$10$...',
    minLength: 8, // Minimum for any password format
  })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, {
    message: 'Password must be at least 8 characters',
  })
  password: string; // Already hashed password from calling service
}
