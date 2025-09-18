import { IsUUID, IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum EventType {
  GAME_PURCHASE = 'game_purchase',
  REVIEW_CREATED = 'review_created',
  FRIEND_ADDED = 'friend_added',
}

export class UpdateProgressDto {
  @IsUUID()
  @ApiProperty({
    description: 'ID пользователя',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId!: string;

  @IsEnum(EventType)
  @ApiProperty({
    description: 'Тип события',
    enum: EventType,
    example: EventType.GAME_PURCHASE,
  })
  eventType!: EventType;

  @IsObject()
  @ApiProperty({
    description: 'Данные события',
    example: { gameId: '123e4567-e89b-12d3-a456-426614174002', price: 1999 },
  })
  eventData!: any;
}
