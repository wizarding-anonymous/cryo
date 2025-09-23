import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RemoveGameFromLibraryDto {
  @ApiProperty({
    description: 'User ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'Game ID',
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  gameId!: string;
}
