import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'The name of the user',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Имя не может быть пустым' })
  @IsString()
  @MaxLength(100, { message: 'Имя не может быть длиннее 100 символов' })
  name: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address of the user',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Email не может быть пустым' })
  @IsEmail({}, { message: 'Некорректный формат email' })
  @MaxLength(255, { message: 'Email не может быть длиннее 255 символов' })
  email: string;

  @ApiProperty({
    example: 'strongPassword123',
    description: 'The password for the user account (min 8 characters)',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'Пароль не может быть пустым' })
  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать не менее 8 символов' })
  password: string;
}
