import { IsUUID, IsString, IsArray, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BasicDeveloperDataDto {
    @IsString()
    companyName: string;

    @IsString()
    companyType: string;
}

export class DeveloperProfileUpdatedEvent {
  @IsUUID()
  userId: string;

  @IsUUID()
  developerId: string;

  @IsArray()
  @IsString({ each: true })
  changedFields: string[];

  @ValidateNested()
  @Type(() => BasicDeveloperDataDto)
  basicData: BasicDeveloperDataDto;

  @IsDateString()
  timestamp: string;
}
