import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { GetGamesDto, SearchGamesDto, CreateGameDto } from './index';

describe('DTO Integration Tests', () => {
    let validationPipe: ValidationPipe;

    beforeEach(async () => {
        validationPipe = new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        });
    });

    describe('ValidationPipe Integration', () => {
        it('should transform and validate GetGamesDto correctly', async () => {
            const rawData = {
                page: '2',
                limit: '20',
                sortBy: 'title',
                sortOrder: 'asc',
                genre: 'Action',
                available: 'true',
            };

            const result = await validationPipe.transform(rawData, {
                type: 'query',
                metatype: GetGamesDto,
            });

            expect(result).toBeInstanceOf(GetGamesDto);
            expect(result.page).toBe(2);
            expect(result.limit).toBe(20);
            expect(result.sortOrder).toBe('ASC');
            expect(result.available).toBe(true);
        });

        it('should reject invalid GetGamesDto data', async () => {
            const rawData = {
                page: '0',
                limit: '101',
                sortBy: 'invalid',
            };

            await expect(
                validationPipe.transform(rawData, {
                    type: 'query',
                    metatype: GetGamesDto,
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should transform and validate SearchGamesDto correctly', async () => {
            const rawData = {
                q: '  cyberpunk  ',
                searchType: 'title',
                page: '1',
                limit: '10',
                minPrice: '100',
                maxPrice: '5000',
            };

            const result = await validationPipe.transform(rawData, {
                type: 'query',
                metatype: SearchGamesDto,
            });

            expect(result).toBeInstanceOf(SearchGamesDto);
            expect(result.q).toBe('cyberpunk');
            expect(result.searchType).toBe('title');
            expect(result.minPrice).toBe(100);
            expect(result.maxPrice).toBe(5000);
        });

        it('should reject SearchGamesDto with empty query', async () => {
            const rawData = {
                q: '',
            };

            await expect(
                validationPipe.transform(rawData, {
                    type: 'query',
                    metatype: SearchGamesDto,
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should transform and validate CreateGameDto correctly', async () => {
            const rawData = {
                title: 'Test Game',
                description: 'A test game',
                price: '59.99',
                currency: 'USD',
                genre: 'Action',
                available: 'true',
                releaseDate: '2023-01-01',
                images: ['/img/test1.jpg', '/img/test2.jpg'],
                systemRequirements: {
                    minimum: 'Windows 10, 4GB RAM',
                    recommended: 'Windows 11, 8GB RAM',
                },
            };

            const result = await validationPipe.transform(rawData, {
                type: 'body',
                metatype: CreateGameDto,
            });

            expect(result).toBeInstanceOf(CreateGameDto);
            expect(result.title).toBe('Test Game');
            expect(result.price).toBe(59.99);
            expect(result.available).toBe(true);
            expect(result.releaseDate).toBeInstanceOf(Date);
        });

        it('should reject CreateGameDto without required fields', async () => {
            const rawData = {
                description: 'A test game',
                // Missing required title and price
            };

            await expect(
                validationPipe.transform(rawData, {
                    type: 'body',
                    metatype: CreateGameDto,
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject non-whitelisted properties', async () => {
            const rawData = {
                page: '1',
                limit: '10',
                maliciousField: 'should be removed',
                anotherBadField: 'also removed',
            };

            await expect(
                validationPipe.transform(rawData, {
                    type: 'query',
                    metatype: GetGamesDto,
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should strip non-whitelisted properties when configured to do so', async () => {
            const lenientPipe = new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: false, // Allow stripping instead of throwing
                transform: true,
                transformOptions: {
                    enableImplicitConversion: true,
                },
            });

            const rawData = {
                page: '1',
                limit: '10',
                maliciousField: 'should be removed',
                anotherBadField: 'also removed',
            };

            const result = await lenientPipe.transform(rawData, {
                type: 'query',
                metatype: GetGamesDto,
            });

            expect(result).not.toHaveProperty('maliciousField');
            expect(result).not.toHaveProperty('anotherBadField');
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
        });
    });

    describe('DTO Type Safety', () => {
        it('should ensure all DTOs are properly typed', () => {
            // This test ensures TypeScript compilation catches type issues
            const getGamesDto: GetGamesDto = {
                page: 1,
                limit: 10,
                sortBy: 'title',
                sortOrder: 'ASC',
                genre: 'Action',
                available: true,
            };

            const searchGamesDto: SearchGamesDto = {
                ...getGamesDto,
                q: 'test',
                searchType: 'title',
                minPrice: 100,
                maxPrice: 5000,
            };

            expect(getGamesDto.page).toBe(1);
            expect(searchGamesDto.q).toBe('test');
        });
    });
});