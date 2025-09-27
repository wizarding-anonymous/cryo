import { validate } from 'class-validator';
import { IsValidUrl } from './is-valid-url.validator';

class TestClass {
  @IsValidUrl()
  url: any;
}

describe('IsValidUrl Validator', () => {
  let testInstance: TestClass;

  beforeEach(() => {
    testInstance = new TestClass();
  });

  describe('valid URLs', () => {
    it('should pass for HTTP URL', async () => {
      testInstance.url = 'http://example.com';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for HTTPS URL', async () => {
      testInstance.url = 'https://example.com';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for URL with port', async () => {
      testInstance.url = 'http://example.com:8080';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for URL with path', async () => {
      testInstance.url = 'https://example.com/api/users';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for URL with query parameters', async () => {
      testInstance.url = 'https://example.com/api/users?page=1&limit=10';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for URL with fragment', async () => {
      testInstance.url = 'https://example.com/page#section';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for localhost URL', async () => {
      testInstance.url = 'http://localhost:3000';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for IP address URL', async () => {
      testInstance.url = 'http://192.168.1.1:8080';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for subdomain URL', async () => {
      testInstance.url = 'https://api.example.com';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid URLs', () => {
    it('should fail for URL without protocol', async () => {
      testInstance.url = 'example.com';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsValidUrl).toBe(
        'url must be a valid HTTP or HTTPS URL',
      );
    });

    it('should fail for invalid protocol', async () => {
      testInstance.url = 'ftp://example.com';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsValidUrl).toBe(
        'url must be a valid HTTP or HTTPS URL',
      );
    });

    it('should fail for malformed URL', async () => {
      testInstance.url = 'http://';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsValidUrl).toBe(
        'url must be a valid HTTP or HTTPS URL',
      );
    });

    it('should fail for URL with spaces', async () => {
      testInstance.url = 'http://example .com';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsValidUrl).toBe(
        'url must be a valid HTTP or HTTPS URL',
      );
    });

    it('should fail for null', async () => {
      testInstance.url = null;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsValidUrl).toBe(
        'url must be a valid HTTP or HTTPS URL',
      );
    });

    it('should fail for undefined', async () => {
      testInstance.url = undefined;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsValidUrl).toBe(
        'url must be a valid HTTP or HTTPS URL',
      );
    });

    it('should fail for number values', async () => {
      testInstance.url = 123;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsValidUrl).toBe(
        'url must be a valid HTTP or HTTPS URL',
      );
    });

    it('should fail for boolean values', async () => {
      testInstance.url = true;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsValidUrl).toBe(
        'url must be a valid HTTP or HTTPS URL',
      );
    });

    it('should fail for object values', async () => {
      testInstance.url = { url: 'http://example.com' };
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsValidUrl).toBe(
        'url must be a valid HTTP or HTTPS URL',
      );
    });

    it('should fail for array values', async () => {
      testInstance.url = ['http://example.com'];
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsValidUrl).toBe(
        'url must be a valid HTTP or HTTPS URL',
      );
    });

    it('should fail for empty string', async () => {
      testInstance.url = '';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsValidUrl).toBe(
        'url must be a valid HTTP or HTTPS URL',
      );
    });
  });

  describe('custom validation message', () => {
    it('should use custom validation message when provided', async () => {
      class TestClassWithCustomMessage {
        @IsValidUrl({ message: 'Please provide a valid URL' })
        url: any;
      }

      const testInstance = new TestClassWithCustomMessage();
      testInstance.url = 'invalid-url';

      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsValidUrl).toBe(
        'Please provide a valid URL',
      );
    });
  });
});
