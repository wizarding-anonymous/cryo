import { IsIP } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IPParamDto {
  @ApiProperty({ description: 'IP address to check' })
  @IsIP()
  ip!: string;
}