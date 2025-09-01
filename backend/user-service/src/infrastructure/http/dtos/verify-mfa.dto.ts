import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyMfaDto {
  @ApiProperty({ description: 'The 6-digit token from the authenticator app', example: '123456' })
  @IsString()
  @Length(6, 6)
  token: string;
}
