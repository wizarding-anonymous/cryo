import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Error code',
    example: 'FRIEND_REQUEST_NOT_FOUND',
  })
  error!: string;

  @ApiProperty({
    description: 'Error message',
    example: 'Friend request not found',
  })
  message!: string;

  @ApiProperty({
    description: 'HTTP status code',
    example: 404,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Timestamp of the error',
    example: '2024-01-15T10:30:00Z',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Request path where the error occurred',
    example: '/api/friends/request/123',
  })
  path!: string;
}
