import { ApiProperty } from '@nestjs/swagger';

export class SuccessResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Operation completed successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Timestamp of the response',
    example: '2024-01-15T10:30:00Z',
  })
  timestamp!: string;
}
