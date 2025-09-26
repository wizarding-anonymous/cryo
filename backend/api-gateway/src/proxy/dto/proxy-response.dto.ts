import { IsInt, IsNumber, IsObject, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProxyResponseDto {
  @ApiProperty({ 
    description: 'HTTP status code of the response',
    example: 200,
    minimum: 100,
    maximum: 599
  })
  @IsInt()
  @Min(100)
  statusCode!: number;

  @ApiProperty({ 
    description: 'Response headers as key-value pairs',
    example: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
  })
  @IsObject()
  headers!: Record<string, string>;

  @ApiProperty({ description: 'Response body data' })
  body!: any;

  @ApiProperty({ 
    description: 'Request execution time in milliseconds',
    example: 150,
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  executionTime!: number;
}