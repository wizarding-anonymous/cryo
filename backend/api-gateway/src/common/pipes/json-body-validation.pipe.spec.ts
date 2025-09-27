import { BadRequestException } from '@nestjs/common';
import { JsonBodyValidationPipe } from './json-body-validation.pipe';

describe('JsonBodyValidationPipe', () => {
  let pipe: JsonBodyValidationPipe;

  beforeEach(() => {
    pipe = new JsonBodyValidationPipe();
  });

  describe('transform', () => {
    it('should pass through valid JSON objects', () => {
      const validObject = { name: 'John', age: 30 };
      const result = pipe.transform(validObject);
      expect(result).toEqual(validObject);
    });

    it('should pass through valid JSON arrays', () => {
      const validArray = [1, 2, 3, 'test'];
      const result = pipe.transform(validArray);
      expect(result).toEqual(validArray);
    });

    it('should pass through empty objects', () => {
      const emptyObject = {};
      const result = pipe.transform(emptyObject);
      expect(result).toEqual(emptyObject);
    });

    it('should pass through empty arrays', () => {
      const emptyArray: any[] = [];
      const result = pipe.transform(emptyArray);
      expect(result).toEqual(emptyArray);
    });

    it('should pass through nested objects', () => {
      const nestedObject = {
        user: {
          name: 'John',
          profile: {
            age: 30,
            preferences: ['music', 'sports'],
          },
        },
      };
      const result = pipe.transform(nestedObject);
      expect(result).toEqual(nestedObject);
    });

    it('should throw BadRequestException for undefined value', () => {
      expect(() => pipe.transform(undefined)).toThrow(BadRequestException);

      try {
        pipe.transform(undefined);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual({
          error: 'INVALID_BODY',
          message: 'Request body is required',
          statusCode: 400,
        });
      }
    });

    it('should throw BadRequestException for null value', () => {
      expect(() => pipe.transform(null)).toThrow(BadRequestException);

      try {
        pipe.transform(null);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual({
          error: 'INVALID_BODY',
          message: 'Request body is required',
          statusCode: 400,
        });
      }
    });

    it('should throw BadRequestException for string values', () => {
      expect(() => pipe.transform('invalid string')).toThrow(
        BadRequestException,
      );

      try {
        pipe.transform('invalid string');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual({
          error: 'INVALID_BODY',
          message: 'Request body must be a JSON object or array',
          statusCode: 400,
        });
      }
    });

    it('should throw BadRequestException for number values', () => {
      expect(() => pipe.transform(123)).toThrow(BadRequestException);

      try {
        pipe.transform(123);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual({
          error: 'INVALID_BODY',
          message: 'Request body must be a JSON object or array',
          statusCode: 400,
        });
      }
    });

    it('should throw BadRequestException for boolean values', () => {
      expect(() => pipe.transform(true)).toThrow(BadRequestException);
      expect(() => pipe.transform(false)).toThrow(BadRequestException);

      try {
        pipe.transform(true);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual({
          error: 'INVALID_BODY',
          message: 'Request body must be a JSON object or array',
          statusCode: 400,
        });
      }
    });

    it('should throw BadRequestException for function values', () => {
      const func = () => 'test';
      expect(() => pipe.transform(func)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for symbol values', () => {
      const sym = Symbol('test');
      expect(() => pipe.transform(sym)).toThrow(BadRequestException);
    });

    it('should pass through Date objects (they are objects)', () => {
      const date = new Date();
      const result = pipe.transform(date);
      expect(result).toBe(date);
    });

    it('should pass through RegExp objects (they are objects)', () => {
      const regex = /test/g;
      const result = pipe.transform(regex);
      expect(result).toBe(regex);
    });

    it('should pass through class instances (they are objects)', () => {
      class TestClass {
        constructor(public name: string) {}
      }
      const instance = new TestClass('test');
      const result = pipe.transform(instance);
      expect(result).toBe(instance);
    });
  });
});
