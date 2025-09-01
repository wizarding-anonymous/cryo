import { IsString, IsEnum, IsOptional, MaxLength, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CompanySize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  ENTERPRISE = 'enterprise',
}

export class CreateCorporateProfileDto {
  @ApiProperty({ description: 'Company name', example: 'ООО "Игровые Технологии"' })
  @IsString()
  @MaxLength(200)
  companyName: string;

  @ApiProperty({ description: 'Company INN', example: '1234567890' })
  @IsString()
  @MaxLength(12)
  inn: string;

  @ApiProperty({ description: 'Company OGRN', example: '1234567890123' })
  @IsString()
  @MaxLength(15)
  ogrn: string;

  @ApiProperty({ description: 'Legal address', example: 'г. Москва, ул. Тверская, д. 1' })
  @IsString()
  @MaxLength(500)
  legalAddress: string;

  @ApiProperty({ description: 'Industry', example: 'Информационные технологии' })
  @IsString()
  @MaxLength(100)
  industry: string;

  @ApiProperty({
    description: 'Company size',
    enum: CompanySize,
    example: CompanySize.MEDIUM,
  })
  @IsEnum(CompanySize)
  companySize: CompanySize;

  @ApiPropertyOptional({ description: 'Company website', example: 'https://example.com' })
  @IsOptional()
  @IsUrl()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional({ description: 'Headquarters location', example: 'Москва, Россия' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headquarters?: string;
}
