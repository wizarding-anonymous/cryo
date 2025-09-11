import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'Имя не может быть пустым' })
  @IsString()
  @MaxLength(100, { message: 'Имя не может быть длиннее 100 символов' })
  name: string;

  @IsNotEmpty({ message: 'Email не может быть пустым' })
  @IsEmail({}, { message: 'Некорректный формат email' })
  @MaxLength(255, { message: 'Email не может быть длиннее 255 символов' })
  email: string;

  @IsNotEmpty({ message: 'Пароль не может быть пустым' })
  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать не менее 8 символов' })
  password: string;
}
