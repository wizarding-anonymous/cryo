import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { IsString, IsNumber, Min } from 'class-validator';
import { CustomValidationPipe } from './custom-validation.pipe';

class TestDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(1)
  age!: number;
}

describe('CustomValidationPipe', () => {
  let pipe: CustomValidationPipe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomValidationPipe],
    }).compile();

    pipe = module.get<CustomValidationPipe>(CustomValidationPipe);
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should pass valid data', async () => {
    const validData = { name: 'John', age: 25 };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: TestDto,
      data: '',
    };

    const result = await pipe.transform(validData, metadata);
    expect(result).toEqual(validData);
  });

  it('should sanitize XSS attempts', async () => {
    const maliciousData = {
      name: '<script>alert("xss")</script>John',
      age: 25,
    };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: undefined, // Skip validation to test sanitization only
      data: '',
    };

    const result = await pipe.transform(maliciousData, metadata);
    expect(result.name).toBe('John');
    expect(result.name).not.toContain('<script>');
  });

  it('should remove javascript: protocols', async () => {
    const maliciousData = {
      name: 'javascript:alert("xss")John',
      age: 25,
    };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: undefined, // Skip validation to test sanitization only
      data: '',
    };

    const result = await pipe.transform(maliciousData, metadata);
    expect(result.name).toBe('alert("xss")John');
    expect(result.name).not.toContain('javascript:');
  });

  it('should throw BadRequestException for invalid data', async () => {
    const invalidData = { name: 123, age: -1 };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: TestDto,
      data: '',
    };

    await expect(pipe.transform(invalidData, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should format validation errors properly', async () => {
    const invalidData = { name: 123, age: -1 };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: TestDto,
      data: '',
    };

    try {
      await pipe.transform(invalidData, metadata);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const badRequestError = error as BadRequestException;
      expect(badRequestError.getResponse()).toHaveProperty(
        'message',
        'Validation failed',
      );
      expect(badRequestError.getResponse()).toHaveProperty('errors');
      expect(badRequestError.getResponse()).toHaveProperty('timestamp');
    }
  });

  it('should handle nested objects', async () => {
    const nestedData = {
      name: 'John',
      age: 25,
      nested: {
        value: '<script>alert("xss")</script>test',
      },
    };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: undefined, // Skip validation to test sanitization only
      data: '',
    };

    const result = await pipe.transform(nestedData, metadata);
    expect(result.nested.value).toBe('test');
    expect(result.nested.value).not.toContain('<script>');
  });

  it('should handle arrays', async () => {
    const arrayData = {
      name: 'John',
      age: 25,
      tags: ['<script>alert("xss")</script>tag1', 'tag2'],
    };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: undefined, // Skip validation to test sanitization only
      data: '',
    };

    const result = await pipe.transform(arrayData, metadata);
    expect(result.tags[0]).toBe('tag1');
    expect(result.tags[0]).not.toContain('<script>');
    expect(result.tags[1]).toBe('tag2');
  });
});
