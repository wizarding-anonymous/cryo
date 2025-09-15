import { SecurityEvent } from '../../entities/security-event.entity';
import { IsArray, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PaginatedSecurityLogs {
  @ApiProperty({ type: [SecurityEvent] })
  @IsArray()
  items: SecurityEvent[];

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  page: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  pageSize: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  total: number;
}
