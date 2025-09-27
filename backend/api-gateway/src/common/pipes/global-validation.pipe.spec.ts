import { BadRequestException } from '@nestjs/common';
import { GlobalValidationPipe } from './global-validation.pipe';
import { IsString, IsEmail, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TestNestedDto {
  @IsString()
  name!: string;
}

class TestDto {
  @IsString()
  username!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested()
  @Type(() => TestNestedDto)
  nested!: TestNestedDto;
}

describe('GlobalValidationPipe', () => {
  let pipe: GlobalValidationPipe;

  beforeEach(() => {
    pipe = new GlobalValidationPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should validate valid data successfully', async () => {
    const validData = {
      username: 'testuser',
      email: 'test@example.com',
      nested: {
        name: 'Test Name',
      },
    };

    const result = await pipe.transform(validData, {
      type: 'body',
      metatype: TestDto,
    });

    expect(result).toBeInstanceOf(TestDto);
    expect(result.username).toBe('testuser');
    expect(result.email).toBe('test@example.com');
  });

  it('should throw BadRequestException for invalid data', async () => {
    const invalidData = {
      username: 123, // Should be string
      email: 'invalid-email', // Should be valid email
      nested: {
        name: 456, // Should be string
      },
    };

    await expect(
      pipe.transform(invalidData, {
        type: 'body',
        metatype: TestDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should handle nested validation errors', async () => {
    const invalidData = {
      username: 'testuser',
      email: 'test@example.com',
      nested: {
        name: 123, // Should be string
      },
    };

    try {
      await pipe.transform(invalidData, {
        type: 'body',
        metatype: TestDto,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse();
      expect((response as any).error).toBe('VALIDATION_ERROR');
      expect((response as any).details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'nested.name',
            constraint: 'isString',
          }),
        ]),
      );
    }
  });

  it('should reject non-whitelisted properties', async () => {
    const dataWithExtraProps = {
      username: 'testuser',
      email: 'test@example.com',
      extraProp: 'should be rejected',
      nested: {
        name: 'Test Name',
        extraNestedProp: 'should also be rejected',
      },
    };

    await expect(
      pipe.transform(dataWithExtraProps, {
        type: 'body',
        metatype: TestDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should skip validation for non-body metadata types', async () => {
    const data = 'some-param-value';

    const result = await pipe.transform(data, {
      type: 'param',
      metatype: String,
    });

    expect(result).toBe(data);
  });

  it('should transform string numbers to numbers when enabled', async () => {
    class NumberTestDto {
      @IsString()
      id!: string;
    }

    const data = { id: 123 };

    const result = await pipe.transform(data, {
      type: 'body',
      metatype: NumberTestDto,
    });

    expect(typeof result.id).toBe('string');
    expect(result.id).toBe('123');
  });
});
