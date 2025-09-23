import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ValidationPipe } from './validation.pipe';
import { IsString, IsUUID, IsNotEmpty } from 'class-validator';

class TestDto {
    @IsUUID()
    @IsNotEmpty()
    id!: string;

    @IsString()
    @IsNotEmpty()
    name!: string;
}

describe('ValidationPipe', () => {
    let pipe: ValidationPipe;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ValidationPipe],
        }).compile();

        pipe = module.get<ValidationPipe>(ValidationPipe);
    });

    it('should be defined', () => {
        expect(pipe).toBeDefined();
    });

    it('should pass validation for valid data', async () => {
        const validData = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test Achievement',
        };

        const result = await pipe.transform(validData, {
            type: 'body',
            metatype: TestDto,
        });

        expect(result).toBeInstanceOf(TestDto);
        expect(result.id).toBe(validData.id);
        expect(result.name).toBe(validData.name);
    });

    it('should throw BadRequestException for invalid UUID', async () => {
        const invalidData = {
            id: 'invalid-uuid',
            name: 'Test Achievement',
        };

        await expect(
            pipe.transform(invalidData, {
                type: 'body',
                metatype: TestDto,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty required fields', async () => {
        const invalidData = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: '', // Empty string
        };

        await expect(
            pipe.transform(invalidData, {
                type: 'body',
                metatype: TestDto,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with detailed error messages', async () => {
        const invalidData = {
            id: 'invalid-uuid',
            name: '',
        };

        try {
            await pipe.transform(invalidData, {
                type: 'body',
                metatype: TestDto,
            });
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            expect((error as BadRequestException).getResponse()).toEqual({
                message: 'Validation failed',
                details: expect.arrayContaining([
                    expect.stringContaining('id must be a UUID'),
                    expect.stringContaining('name should not be empty'),
                ]),
            });
        }
    });

    it('should return value unchanged for primitive types', async () => {
        const stringValue = 'test string';
        const result = await pipe.transform(stringValue, {
            type: 'param',
            metatype: String,
        });

        expect(result).toBe(stringValue);
    });

    it('should return value unchanged when no metatype', async () => {
        const value = { test: 'data' };
        const result = await pipe.transform(value, {
            type: 'body',
        });

        expect(result).toBe(value);
    });

    it('should handle array types', async () => {
        const arrayValue = [1, 2, 3];
        const result = await pipe.transform(arrayValue, {
            type: 'body',
            metatype: Array,
        });

        expect(result).toBe(arrayValue);
    });

    it('should handle object types without validation', async () => {
        const objectValue = { key: 'value' };
        const result = await pipe.transform(objectValue, {
            type: 'body',
            metatype: Object,
        });

        expect(result).toBe(objectValue);
    });
});