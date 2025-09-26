import { BadRequestException } from '@nestjs/common';
import { ProxyValidationPipe } from './proxy-validation.pipe';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

// Mock class-validator and class-transformer
jest.mock('class-validator');
jest.mock('class-transformer');

const mockValidate = validate as jest.MockedFunction<typeof validate>;
const mockPlainToClass = plainToClass as jest.MockedFunction<typeof plainToClass>;

// Mock the ProxyRequestDto to avoid decorator issues
jest.mock('../dto/proxy-request.dto', () => ({
  ProxyRequestDto: class MockProxyRequestDto {
    method?: string;
    path?: string;
    headers?: any;
    body?: any;
    query?: any;
  },
}));

describe('ProxyValidationPipe', () => {
    let pipe: ProxyValidationPipe;

    beforeEach(() => {
        pipe = new ProxyValidationPipe();
        jest.clearAllMocks();
    });

    describe('transform', () => {
        it('should return value unchanged for non-body metadata types', async () => {
            const value = { test: 'data' };
            const metadata = { type: 'param' as const, metatype: String, data: undefined };

            const result = await pipe.transform(value, metadata);

            expect(result).toBe(value);
            expect(mockPlainToClass).not.toHaveBeenCalled();
            expect(mockValidate).not.toHaveBeenCalled();
        });

        it('should return value unchanged for query metadata type', async () => {
            const value = { page: '1', limit: '10' };
            const metadata = { type: 'query' as const, metatype: Object, data: undefined };

            const result = await pipe.transform(value, metadata);

            expect(result).toBe(value);
            expect(mockPlainToClass).not.toHaveBeenCalled();
            expect(mockValidate).not.toHaveBeenCalled();
        });

        it('should return value unchanged for custom metadata type', async () => {
            const value = { custom: 'data' };
            const metadata = { type: 'custom' as const, metatype: Object, data: undefined };

            const result = await pipe.transform(value, metadata);

            expect(result).toBe(value);
            expect(mockPlainToClass).not.toHaveBeenCalled();
            expect(mockValidate).not.toHaveBeenCalled();
        });

        it('should return value unchanged when no value provided', async () => {
            const metadata = { type: 'body' as const, metatype: Object, data: undefined };

            const result1 = await pipe.transform(null, metadata);
            const result2 = await pipe.transform(undefined, metadata);
            const result3 = await pipe.transform('', metadata);
            const result4 = await pipe.transform(0, metadata);
            const result5 = await pipe.transform(false, metadata);

            expect(result1).toBe(null);
            expect(result2).toBe(undefined);
            expect(result3).toBe('');
            expect(result4).toBe(0);
            expect(result5).toBe(false);
            expect(mockPlainToClass).not.toHaveBeenCalled();
            expect(mockValidate).not.toHaveBeenCalled();
        });

        it('should validate and return transformed object when validation passes', async () => {
            const inputValue = {
                method: 'GET',
                url: '/api/users',
                headers: { 'authorization': 'Bearer token' },
            };
            const transformedObject = { ...inputValue, transformed: true };
            const metadata = { type: 'body' as const, metatype: Object, data: undefined };

            mockPlainToClass.mockReturnValue(transformedObject as any);
            mockValidate.mockResolvedValue([]);

            const result = await pipe.transform(inputValue, metadata);

            expect(mockPlainToClass).toHaveBeenCalledWith(expect.any(Function), inputValue);
            expect(mockValidate).toHaveBeenCalledWith(transformedObject, {
                whitelist: true,
                forbidNonWhitelisted: true,
            });
            expect(result).toBe(transformedObject);
        });

        it('should throw BadRequestException when validation fails', async () => {
            const inputValue = {
                method: 'INVALID_METHOD',
                url: 'invalid-url',
            };
            const transformedObject = { ...inputValue };
            const metadata = { type: 'body' as const, metatype: Object, data: undefined };

            const validationErrors = [
                {
                    property: 'method',
                    constraints: {
                        isIn: 'method must be one of the following values: GET, POST, PUT, DELETE, PATCH',
                    },
                },
                {
                    property: 'url',
                    constraints: {
                        isUrl: 'url must be a valid URL',
                    },
                },
            ];

            mockPlainToClass.mockReturnValue(transformedObject as any);
            mockValidate.mockResolvedValue(validationErrors as any);

            await expect(pipe.transform(inputValue, metadata)).rejects.toThrow(BadRequestException);

            try {
                await pipe.transform(inputValue, metadata);
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException);
                const response = (error as BadRequestException).getResponse() as {
                    error: string;
                    message: string;
                    statusCode: number;
                    details: string[];
                };
                expect(response).toEqual({
                    error: 'PROXY_VALIDATION_ERROR',
                    message: 'Proxy request validation failed',
                    statusCode: 400,
                    details: [
                        'method must be one of the following values: GET, POST, PUT, DELETE, PATCH',
                        'url must be a valid URL',
                    ],
                });
            }
        });

        it('should handle validation errors without constraints', async () => {
            const inputValue = { invalid: 'data' };
            const transformedObject = { ...inputValue };
            const metadata = { type: 'body' as const, metatype: Object, data: undefined };

            const validationErrors = [
                {
                    property: 'invalid',
                    constraints: undefined,
                },
            ];

            mockPlainToClass.mockReturnValue(transformedObject as any);
            mockValidate.mockResolvedValue(validationErrors as any);

            await expect(pipe.transform(inputValue, metadata)).rejects.toThrow(BadRequestException);

            try {
                await pipe.transform(inputValue, metadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as {
                    details: string[];
                };
                expect(response.details).toEqual(['Validation failed']);
            }
        });

        it('should handle validation errors with empty constraints', async () => {
            const inputValue = { invalid: 'data' };
            const transformedObject = { ...inputValue };
            const metadata = { type: 'body' as const, metatype: Object, data: undefined };

            const validationErrors = [
                {
                    property: 'invalid',
                    constraints: {},
                },
            ];

            mockPlainToClass.mockReturnValue(transformedObject as any);
            mockValidate.mockResolvedValue(validationErrors as any);

            await expect(pipe.transform(inputValue, metadata)).rejects.toThrow(BadRequestException);

            try {
                await pipe.transform(inputValue, metadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as {
                    details: string[];
                };
                expect(response.details).toEqual(['Validation failed']);
            }
        });

        it('should handle multiple constraint violations for single property', async () => {
            const inputValue = { method: '' };
            const transformedObject = { ...inputValue };
            const metadata = { type: 'body' as const, metatype: Object, data: undefined };

            const validationErrors = [
                {
                    property: 'method',
                    constraints: {
                        isNotEmpty: 'method should not be empty',
                        isIn: 'method must be one of the following values: GET, POST, PUT, DELETE, PATCH',
                    },
                },
            ];

            mockPlainToClass.mockReturnValue(transformedObject as any);
            mockValidate.mockResolvedValue(validationErrors as any);

            await expect(pipe.transform(inputValue, metadata)).rejects.toThrow(BadRequestException);

            try {
                await pipe.transform(inputValue, metadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as {
                    details: string[];
                };
                expect(response.details).toEqual([
                    'method should not be empty, method must be one of the following values: GET, POST, PUT, DELETE, PATCH',
                ]);
            }
        });

        it('should handle complex nested validation errors', async () => {
            const inputValue = {
                method: 'GET',
                url: '/api/users',
                headers: 'invalid-headers',
                body: 123,
            };
            const transformedObject = { ...inputValue };
            const metadata = { type: 'body' as const, metatype: Object, data: undefined };

            const validationErrors = [
                {
                    property: 'headers',
                    constraints: {
                        isObject: 'headers must be an object',
                    },
                },
                {
                    property: 'body',
                    constraints: {
                        isObject: 'body must be an object or array',
                        isOptional: 'body is optional but must be valid when provided',
                    },
                },
            ];

            mockPlainToClass.mockReturnValue(transformedObject as any);
            mockValidate.mockResolvedValue(validationErrors as any);

            await expect(pipe.transform(inputValue, metadata)).rejects.toThrow(BadRequestException);

            try {
                await pipe.transform(inputValue, metadata);
            } catch (error) {
                const response = (error as BadRequestException).getResponse() as {
                    details: string[];
                };
                expect(response.details).toEqual([
                    'headers must be an object',
                    'body must be an object or array, body is optional but must be valid when provided',
                ]);
            }
        });

        it('should pass validation options correctly', async () => {
            const inputValue = { method: 'GET', url: '/api/users' };
            const transformedObject = { ...inputValue };
            const metadata = { type: 'body' as const, metatype: Object, data: undefined };

            mockPlainToClass.mockReturnValue(transformedObject as any);
            mockValidate.mockResolvedValue([]);

            await pipe.transform(inputValue, metadata);

            expect(mockValidate).toHaveBeenCalledWith(transformedObject, {
                whitelist: true,
                forbidNonWhitelisted: true,
            });
        });
    });
});