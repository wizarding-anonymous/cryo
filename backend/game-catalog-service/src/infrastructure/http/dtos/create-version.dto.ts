import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsUrl } from 'class-validator';

export class CreateVersionDto {
  @ApiProperty({ example: '1.2.0', description: 'The version number (e.g., semantic versioning)' })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({ example: 'Added new levels and fixed bugs.', description: 'A summary of changes in this version.' })
  @IsString()
  @IsOptional()
  changelog: string;

  @ApiProperty({ example: 1073741824, description: 'The file size of the new version in bytes.' })
  @IsNumber()
  @IsOptional()
  fileSize: number;

  @ApiProperty({ example: 'https://example.com/downloads/game-v1.2.0.zip', description: 'The URL to download this version.' })
  @IsUrl()
  @IsOptional()
  downloadUrl: string;
}
