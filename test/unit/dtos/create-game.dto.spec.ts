import { validate } from 'class-validator';
import { CreateGameDto } from '../../../src/infrastructure/http/dtos/create-game.dto';
import { plainToInstance } from 'class-transformer';

describe('CreateGameDto', () => {
  it('should pass validation with a valid DTO', async () => {
    const validDto = {
      title: 'Valid Game Title',
      developerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      price: 59.99,
      isFree: false,
      categoryIds: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'],
      tagIds: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'],
    };

    const dtoInstance = plainToInstance(CreateGameDto, validDto);
    const errors = await validate(dtoInstance);
    expect(errors.length).toBe(0);
  });

  it('should fail if title is missing', async () => {
    const invalidDto = {
      // title is missing
      developerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      price: 59.99,
      isFree: false,
    };
    const dtoInstance = plainToInstance(CreateGameDto, invalidDto);
    const errors = await validate(dtoInstance);
    expect(errors.length).toBeGreaterThan(0);
    const titleError = errors.find(err => err.property === 'title');
    expect(titleError).toBeDefined();
    expect(titleError.constraints).toHaveProperty('isNotEmpty');
  });

  it('should fail if title is too short', async () => {
    const invalidDto = {
      title: 'a', // too short
      developerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      price: 59.99,
      isFree: false,
    };
    const dtoInstance = plainToInstance(CreateGameDto, invalidDto);
    const errors = await validate(dtoInstance);
    expect(errors.length).toBeGreaterThan(0);
    const titleError = errors.find(err => err.property === 'title');
    expect(titleError).toBeDefined();
    expect(titleError.constraints).toHaveProperty('minLength');
  });

  it('should fail if developerId is not a UUID', async () => {
    const invalidDto = {
      title: 'Valid Game Title',
      developerId: 'not-a-uuid',
      price: 59.99,
      isFree: false,
    };
    const dtoInstance = plainToInstance(CreateGameDto, invalidDto);
    const errors = await validate(dtoInstance);
    expect(errors.length).toBeGreaterThan(0);
    const developerIdError = errors.find(err => err.property === 'developerId');
    expect(developerIdError).toBeDefined();
    expect(developerIdError.constraints).toHaveProperty('isUuid');
  });

  it('should fail if price is negative', async () => {
    const invalidDto = {
      title: 'Valid Game Title',
      developerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      price: -10,
      isFree: false,
    };
    const dtoInstance = plainToInstance(CreateGameDto, invalidDto);
    const errors = await validate(dtoInstance);
    expect(errors.length).toBeGreaterThan(0);
    const priceError = errors.find(err => err.property === 'price');
    expect(priceError).toBeDefined();
    expect(priceError.constraints).toHaveProperty('min');
  });

  it('should pass if optional fields are missing', async () => {
    const validDto = {
      title: 'Game Without Optional Fields',
      developerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      price: 0,
      isFree: true,
    };
    const dtoInstance = plainToInstance(CreateGameDto, validDto);
    const errors = await validate(dtoInstance);
    expect(errors.length).toBe(0);
  });
});
