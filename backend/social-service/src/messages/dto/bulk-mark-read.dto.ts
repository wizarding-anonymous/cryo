import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class BulkMarkReadDto {
  @ApiProperty({
    description: 'Array of message IDs to mark as read',
    example: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID(4, { each: true })
  @IsNotEmpty({ each: true })
  messageIds!: string[];
}
