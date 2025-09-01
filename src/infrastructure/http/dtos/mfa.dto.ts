import { IsString, IsOptional, IsEnum, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnableSmsDto {
  @ApiProperty({ description: 'Phone number in international format (+7XXXXXXXXXX)' })
  @IsPhoneNumber('RU')
  phoneNumber: string;
}

export class VerifySmsDto {
  @ApiProperty({ description: '6-digit SMS verification code' })
  @IsString()
  code: string;
}

export class VerifyMfaTokenDto {
  @ApiProperty({ description: 'MFA token (TOTP, SMS code, or backup code)' })
  @IsString()
  token: string;

  @ApiProperty({ 
    description: 'MFA method type', 
    enum: ['totp', 'sms', 'backup'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['totp', 'sms', 'backup'])
  method?: 'totp' | 'sms' | 'backup';
}