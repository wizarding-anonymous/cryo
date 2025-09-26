import { validate } from 'class-validator';
import { IsIpAddress } from './is-ip-address.validator';

class TestClass {
  @IsIpAddress()
  ip: any;
}

describe('IsIpAddress Validator', () => {
  let testInstance: TestClass;

  beforeEach(() => {
    testInstance = new TestClass();
  });

  describe('valid IP addresses', () => {
    it('should pass for valid IPv4 address', async () => {
      testInstance.ip = '192.168.1.1';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for localhost IPv4', async () => {
      testInstance.ip = '127.0.0.1';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for zero IPv4', async () => {
      testInstance.ip = '0.0.0.0';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for broadcast IPv4', async () => {
      testInstance.ip = '255.255.255.255';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for valid IPv6 address', async () => {
      testInstance.ip = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for compressed IPv6 address', async () => {
      testInstance.ip = '2001:db8:85a3::8a2e:370:7334';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });

    it('should pass for localhost IPv6', async () => {
      testInstance.ip = '::1';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid IP addresses', () => {
    it('should fail for invalid IPv4 format', async () => {
      testInstance.ip = '192.168.1';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsIpAddress).toBe('ip must be a valid IP address (IPv4 or IPv6)');
    });

    it('should fail for IPv4 with invalid octets', async () => {
      testInstance.ip = '256.256.256.256';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsIpAddress).toBe('ip must be a valid IP address (IPv4 or IPv6)');
    });

    it('should fail for invalid IPv6 format', async () => {
      testInstance.ip = '2001:0db8:85a3::8a2e:370g:7334';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsIpAddress).toBe('ip must be a valid IP address (IPv4 or IPv6)');
    });

    it('should fail for null', async () => {
      testInstance.ip = null;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsIpAddress).toBe('ip must be a valid IP address (IPv4 or IPv6)');
    });

    it('should fail for undefined', async () => {
      testInstance.ip = undefined;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsIpAddress).toBe('ip must be a valid IP address (IPv4 or IPv6)');
    });

    it('should fail for number values', async () => {
      testInstance.ip = 123;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsIpAddress).toBe('ip must be a valid IP address (IPv4 or IPv6)');
    });

    it('should fail for boolean values', async () => {
      testInstance.ip = true;
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsIpAddress).toBe('ip must be a valid IP address (IPv4 or IPv6)');
    });

    it('should fail for empty string', async () => {
      testInstance.ip = '';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsIpAddress).toBe('ip must be a valid IP address (IPv4 or IPv6)');
    });

    it('should fail for hostname', async () => {
      testInstance.ip = 'localhost';
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsIpAddress).toBe('ip must be a valid IP address (IPv4 or IPv6)');
    });
  });

  describe('custom validation message', () => {
    it('should use custom validation message when provided', async () => {
      class TestClassWithCustomMessage {
        @IsIpAddress({ message: 'Please provide a valid IP address' })
        ip: any;
      }

      const testInstance = new TestClassWithCustomMessage();
      testInstance.ip = 'invalid-ip';
      
      const errors = await validate(testInstance);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.IsIpAddress).toBe('Please provide a valid IP address');
    });
  });
});