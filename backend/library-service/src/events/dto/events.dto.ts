import { IsUUID, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GameAddedToLibraryEvent {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Game ID' })
  @IsUUID()
  gameId!: string;

  @ApiProperty({ description: 'Timestamp of the event' })
  @IsDate()
  timestamp!: Date;

  constructor(partial?: Partial<GameAddedToLibraryEvent>) {
    Object.assign(this, partial);
  }
}

export class GameRemovedFromLibraryEvent {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Game ID' })
  @IsUUID()
  gameId!: string;

  @ApiProperty({ description: 'Timestamp of the event' })
  @IsDate()
  timestamp!: Date;

  constructor(partial?: Partial<GameRemovedFromLibraryEvent>) {
    Object.assign(this, partial);
  }
}
