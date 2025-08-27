import { IsUUID, IsString, IsArray, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BasicPublisherDataDto {
    @IsString()
    companyName: string;

    @IsString()
    companyType: string;
}

export class PublisherProfileUpdatedEvent {
  @IsUUID()
  userId: string;

  @IsUUID()
  publisherId: string;

  @IsArray()
  @IsString({ each: true })
  changedFields: string[];

  @ValidateNested()
  @Type(() => BasicPublisherDataDto)
  basicData: BasicPublisherDataDto;

  @IsDateString()
  timestamp: string;
}
