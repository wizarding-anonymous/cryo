import { validate } from 'class-validator';
import { IsSafePath } from './safe-path.validator';

class TestClass {
  @IsSafePath()
  path: any;
}

describe('IsSafePath Validator', () => {
  let testInstance: TestClass;

  beforeEach(() => {
    testInstance = new TestClass();
  });

  describe('valid safe paths', () => {
    it('should pass for simple absolute path', async () => {
      testInstance.path = '/api/users';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for nested absolute path', async () => {
      testInstance.path = '/api/users/123/profile';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for path with query parameters', async () => {
      testInstance.path = '/api/users?page=1&limit=10';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for path with hyphens and underscores', async () => {
      testInstance.path = '/api/user-profiles/user_123';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for path with numbers', async () => {
      testInstance.path = '/api/v1/users/123';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for root path', async () => {
      testInstance.path = '/';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for path with special characters', async () => {
      testInstance.path = '/api/users/123?filter=name:john&sort=created_at';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid paths', () => {
    it('should fail for relative path', async () => {
      testInstance.path = 'api/users';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });

    it('should fail for path with directory traversal', async () => {
      testInstance.path = '/api/../admin';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });

    it('should fail for path with double dots', async () => {
      testInstance.path = '/api/users/../admin';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });

    it('should fail for path with spaces', async () => {
      testInstance.path = '/api/users with spaces';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });

    it('should fail for path with tabs', async () => {
      testInstance.path = '/api/users\twith\ttabs';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });

    it('should fail for path with newlines', async () => {
      testInstance.path = '/api/users\nwith\nnewlines';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });

    it('should fail for null', async () => {
      testInstance.path = null;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });

    it('should fail for undefined', async () => {
      testInstance.path = undefined;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });

    it('should fail for number values', async () => {
      testInstance.path = 123;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });

    it('should fail for boolean values', async () => {
      testInstance.path = true;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });

    it('should fail for object values', async () => {
      testInstance.path = { path: '/api/users' };
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });

    it('should fail for array values', async () => {
      testInstance.path = ['/api/users'];
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });

    it('should fail for empty string', async () => {
      testInstance.path = '';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('path must be an absolute, safe path');
    });
  });

  describe('custom validation message', () => {
    it('should use custom validation message when provided', async () => {
      class TestClassWithCustomMessage {
        @IsSafePath({ message: 'Please provide a valid and safe path' })
        path: any;
      }

      const testInstance = new TestClassWithCustomMessage();
      testInstance.path = 'invalid-path';
      
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsSafePath).toBe('Please provide a valid and safe path');
    });
  });
});