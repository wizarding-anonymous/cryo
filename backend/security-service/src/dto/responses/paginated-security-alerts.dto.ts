import { IsArray, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SecurityAlert } from '../../entities/security-alert.entity';

export class PaginatedSecurityAlerts {
  @ApiProperty({ type: [SecurityAlert] })
  @IsArray()
  items: SecurityAlert[];

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
