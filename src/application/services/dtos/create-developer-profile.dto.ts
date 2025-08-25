import { IsString, IsEmail, IsOptional, IsUrl } from 'class-validator';

export class CreateDeveloperProfileDto {
  @IsString()
  userId: string;

  @IsString()
  companyName: string;

  @IsString()
  companyType: string;

  @IsString()
  @IsOptional()
  inn?: string;

  @IsString()
  @IsOptional()
  ogrn?: string;

  @IsString()
  @IsOptional()
  legalAddress?: string;

  @IsEmail()
  contactEmail: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsUrl()
  @IsOptional()
  website?: string;
}
