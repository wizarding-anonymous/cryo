import { IsString, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CorporateInfoDto {
  @IsString()
  inn: string;

  @IsString()
  ogrn: string;

  @IsString()
  @IsOptional()
  kpp?: string;

  @IsString()
  legalAddress: string;
}

class ContactsDto {
  @IsString()
  businessEmail: string;

  @IsString()
  @IsOptional()
  pressEmail?: string;
}

export class CreatePublisherProfileDto {
  @IsString()
  userId: string;

  @IsString()
  companyName: string;

  @IsString()
  companyType: string;

  @IsObject()
  @ValidateNested()
  @Type(() => CorporateInfoDto)
  corporateInfo: CorporateInfoDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ContactsDto)
  contacts: ContactsDto;
}
