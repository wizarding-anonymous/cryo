import { validate } from 'class-validator';
import { IsHttpMethod } from './is-http-method.validator';
import { HttpMethod } from '../enums/http-method.enum';

class TestClass {
  @IsHttpMethod()
  method: any;
}

describe('IsHttpMethod Validator', () => {
  let testInstance: TestClass;

  beforeEach(() => {
    testInstance = new TestClass();
  });

  describe('valid HTTP methods', () => {
    it('should pass for GET method', async () => {
      testInstance.method = 'GET';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for POST method', async () => {
      testInstance.method = 'POST';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for PUT method', async () => {
      testInstance.method = 'PUT';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for DELETE method', async () => {
      testInstance.method = 'DELETE';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for PATCH method', async () => {
      testInstance.method = 'PATCH';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for lowercase methods', async () => {
      testInstance.method = 'get';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for mixed case methods', async () => {
      testInstance.method = 'Post';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for all enum values', async () => {
      const allMethods = Object.values(HttpMethod);

      for (const method of allMethods) {
        testInstance.method = method;
        const errors = await validate(testInstance);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('invalid HTTP methods', () => {
    it('should fail for invalid method', async () => {
      testInstance.method = 'INVALID';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);

      const validMethods = Object.values(HttpMethod).join(', ');
      expect(errors[0].constraints?.IsHttpMethod).toBe(
        `method must be one of: ${validMethods}`,
      );
    });

    it('should fail for null', async () => {
      testInstance.method = null;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
    });

    it('should fail for undefined', async () => {
      testInstance.method = undefined;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
    });

    it('should fail for number values', async () => {
      testInstance.method = 123;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
    });

    it('should fail for boolean values', async () => {
      testInstance.method = true;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
    });

    it('should fail for object values', async () => {
      testInstance.method = { method: 'GET' };
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
    });

    it('should fail for array values', async () => {
      testInstance.method = ['GET'];
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
    });

    it('should fail for empty string', async () => {
      testInstance.method = '';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
    });
  });

  describe('custom validation message', () => {
    it('should use custom validation message when provided', async () => {
      class TestClassWithCustomMessage {
        @IsHttpMethod({ message: 'Please provide a valid HTTP method' })
        method: any;
      }

      const testInstance = new TestClassWithCustomMessage();
      testInstance.method = 'INVALID';

      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsHttpMethod).toBe(
        'Please provide a valid HTTP method',
      );
    });
  });
});
