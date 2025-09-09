import { IsString, IsNotEmpty, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MediaType } from '../../../application/services/media.service';

export class CreateMediaDto {
  @ApiProperty({ description: 'The ID of the game this media belongs to.' })
  @IsUUID()
  @IsNotEmpty()
  gameId: string;

  @ApiProperty({ description: 'The type of media being uploaded.', enum: MediaType })
  @IsEnum(MediaType)
  @IsNotEmpty()
  mediaType: MediaType;
}
