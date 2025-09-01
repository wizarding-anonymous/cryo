import { IsString, IsEnum, IsOptional, MaxLength, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CompanySize } from './create-corporate-profile.dto';

export class UpdateCorporateProfileDto {
  @ApiPropertyOptional({ description: 'Company name', example: 'ООО "Новые Игровые Технологии"' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({ description: 'Industry', example: 'Разработка игр' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({
    description: 'Company size',
    enum: CompanySize,
    example: CompanySize.LARGE,
  })
  @IsOptional()
  @IsEnum(CompanySize)
  companySize?: CompanySize;

  @ApiPropertyOptional({ description: 'Company website', example: 'https://newexample.com' })
  @IsOptional()
  @IsUrl()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional({ description: 'Headquarters location', example: 'Санкт-Петербург, Россия' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headquarters?: string;
}
