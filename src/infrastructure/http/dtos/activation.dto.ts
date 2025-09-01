import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendActivationDto {
  @ApiProperty({ description: 'Email address to resend activation to' })
  @IsEmail()
  email: string;
}