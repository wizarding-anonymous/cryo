import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsPasswordStrong } from '../../common/validators';

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
    example: 'StrongPass123!',
    description: 'Пароль пользователя (минимум 8 символов, должен содержать заглавные и строчные буквы, цифры и специальные символы)',
    minLength: 8,
    maxLength: 128,
  })
  @IsNotEmpty({ message: 'Пароль не может быть пустым' })
  @IsString({ message: 'Пароль должен быть строкой' })
  @IsPasswordStrong({
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    allowedSpecialChars: '@$!%*?&',
  })
  password: string;
}