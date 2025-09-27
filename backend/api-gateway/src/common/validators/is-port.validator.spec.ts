import { validate } from 'class-validator';
import { IsPort } from './is-port.validator';

class TestClass {
  @IsPort()
  port: any;
}

describe('IsPort Validator', () => {
  let testInstance: TestClass;

  beforeEach(() => {
    testInstance = new TestClass();
  });

  describe('valid port numbers', () => {
    it('should pass for port 80', async () => {
      testInstance.port = 80;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for port 443', async () => {
      testInstance.port = 443;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for port 3000', async () => {
      testInstance.port = 3000;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for minimum port (1)', async () => {
      testInstance.port = 1;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for maximum port (65535)', async () => {
      testInstance.port = 65535;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for port as string', async () => {
      testInstance.port = '8080';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for port string with leading zeros', async () => {
      testInstance.port = '08080';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid port numbers', () => {
    it('should fail for port 0', async () => {
      testInstance.port = 0;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'port must be a valid port number (1-65535)',
      );
    });

    it('should fail for port above maximum (65536)', async () => {
      testInstance.port = 65536;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'port must be a valid port number (1-65535)',
      );
    });

    it('should fail for negative port', async () => {
      testInstance.port = -1;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'port must be a valid port number (1-65535)',
      );
    });

    it('should fail for floating point number', async () => {
      testInstance.port = 80.5;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'port must be a valid port number (1-65535)',
      );
    });

    it('should fail for invalid string', async () => {
      testInstance.port = 'not-a-port';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'port must be a valid port number (1-65535)',
      );
    });

    it('should fail for string with decimal', async () => {
      testInstance.port = '80.5';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'port must be a valid port number (1-65535)',
      );
    });

    it('should fail for null', async () => {
      testInstance.port = null;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'port must be a valid port number (1-65535)',
      );
    });

    it('should fail for undefined', async () => {
      testInstance.port = undefined;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'port must be a valid port number (1-65535)',
      );
    });

    it('should fail for boolean values', async () => {
      testInstance.port = true;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'port must be a valid port number (1-65535)',
      );
    });

    it('should fail for object values', async () => {
      testInstance.port = { port: 80 };
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'port must be a valid port number (1-65535)',
      );
    });

    it('should fail for array values', async () => {
      testInstance.port = [80];
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'port must be a valid port number (1-65535)',
      );
    });

    it('should fail for empty string', async () => {
      testInstance.port = '';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'port must be a valid port number (1-65535)',
      );
    });
  });

  describe('custom validation message', () => {
    it('should use custom validation message when provided', async () => {
      class TestClassWithCustomMessage {
        @IsPort({ message: 'Please provide a valid port number' })
        port: any;
      }

      const testInstance = new TestClassWithCustomMessage();
      testInstance.port = 'invalid-port';

      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsPort).toBe(
        'Please provide a valid port number',
      );
    });
  });
});
