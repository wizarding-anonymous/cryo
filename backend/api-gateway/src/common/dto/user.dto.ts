import { IsArray, IsEmail, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  id!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsString()
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'User roles',
    example: ['user', 'admin'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  roles!: string[];

  @ApiProperty({
    description: 'User permissions',
    example: ['read:games', 'write:profile'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
