import { IsString, IsArray, IsEnum, ValidateNested, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

class DocumentDto {
  @IsEnum(['passport', 'inn_certificate', 'ogrn_certificate'])
  type: 'passport' | 'inn_certificate' | 'ogrn_certificate';

  @IsString()
  filePath: string;

  @IsDate()
  @Type(() => Date)
  uploadedAt: Date;
}

export class SubmitVerificationDto {
  @IsString()
  userId: string;

  @IsEnum(['developer', 'publisher'])
  profileType: 'developer' | 'publisher';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  documents: DocumentDto[];
}
