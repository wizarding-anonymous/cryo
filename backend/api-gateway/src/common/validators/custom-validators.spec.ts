import { validate } from 'class-validator';
import { 
  IsSafePath, 
  IsValidUrl, 
  IsHttpMethod, 
  IsJsonObject, 
  IsPort, 
  IsTimeout, 
  IsIpAddress 
} from './index';

class TestValidationDto {
  @IsSafePath()
  path!: string;

  @IsValidUrl()
  url!: string;

  @IsHttpMethod()
  method!: string;

  @IsJsonObject()
  jsonData!: any;

  @IsPort()
  port!: number;

  @IsTimeout()
  timeout!: number;

  @IsIpAddress()
  ipAddress!: string;
}

describe('Custom Validators', () => {
  describe('IsSafePath', () => {
    it('should validate safe paths', async () => {
      const dto = new TestValidationDto();
      dto.path = '/api/users/123';
      dto.url = 'https://example.com';
      dto.method = 'GET';
      dto.jsonData = { test: 'data' };
      dto.port = 3000;
      dto.timeout = 5000;
      dto.ipAddress = '192.168.1.1';

      const errors = await validate(dto);
      const pathErrors = errors.filter(e => e.property === 'path');
      expect(pathErrors).toHaveLength(0);
    });

    it('should reject unsafe paths', async () => {
      const testCases = [
        'relative/path', // Not absolute
        '/api/../etc/passwd', // Contains ..
        '/api/users with spaces', // Contains spaces
        123, // Not a string
      ];

      for (const testPath of testCases) {
        const dto = new TestValidationDto();
        dto.path = testPath as string;
        dto.url = 'https://example.com';
        dto.method = 'GET';
        dto.jsonData = { test: 'data' };
        dto.port = 3000;
        dto.timeout = 5000;
        dto.ipAddress = '192.168.1.1';

        const errors = await validate(dto);
        const pathErrors = errors.filter(e => e.property === 'path');
        expect(pathErrors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('IsValidUrl', () => {
    it('should validate valid URLs', async () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://api.example.com/v1/users',
      ];

      for (const url of validUrls) {
        const dto = new TestValidationDto();
        dto.path = '/api/test';
        dto.url = url;
        dto.method = 'GET';
        dto.jsonData = { test: 'data' };
        dto.port = 3000;
        dto.timeout = 5000;
        dto.ipAddress = '192.168.1.1';

        const errors = await validate(dto);
        const urlErrors = errors.filter(e => e.property === 'url');
        expect(urlErrors).toHaveLength(0);
      }
    });

    it('should reject invalid URLs', async () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com', // Wrong protocol
        'javascript:alert(1)', // Dangerous protocol
        123, // Not a string
      ];

      for (const url of invalidUrls) {
        const dto = new TestValidationDto();
        dto.path = '/api/test';
        dto.url = url as string;
        dto.method = 'GET';
        dto.jsonData = { test: 'data' };
        dto.port = 3000;
        dto.timeout = 5000;
        dto.ipAddress = '192.168.1.1';

        const errors = await validate(dto);
        const urlErrors = errors.filter(e => e.property === 'url');
        expect(urlErrors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('IsHttpMethod', () => {
    it('should validate HTTP methods', async () => {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'get', 'post'];

      for (const method of validMethods) {
        const dto = new TestValidationDto();
        dto.path = '/api/test';
        dto.url = 'https://example.com';
        dto.method = method;
        dto.jsonData = { test: 'data' };
        dto.port = 3000;
        dto.timeout = 5000;
        dto.ipAddress = '192.168.1.1';

        const errors = await validate(dto);
        const methodErrors = errors.filter(e => e.property === 'method');
        expect(methodErrors).toHaveLength(0);
      }
    });

    it('should reject invalid HTTP methods', async () => {
      const invalidMethods = ['INVALID', 'TRACE', 123, null];

      for (const method of invalidMethods) {
        const dto = new TestValidationDto();
        dto.path = '/api/test';
        dto.url = 'https://example.com';
        dto.method = method as string;
        dto.jsonData = { test: 'data' };
        dto.port = 3000;
        dto.timeout = 5000;
        dto.ipAddress = '192.168.1.1';

        const errors = await validate(dto);
        const methodErrors = errors.filter(e => e.property === 'method');
        expect(methodErrors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('IsPort', () => {
    it('should validate port numbers', async () => {
      const validPorts = [80, 443, 3000, 8080, '3000', '8080'];

      for (const port of validPorts) {
        const dto = new TestValidationDto();
        dto.path = '/api/test';
        dto.url = 'https://example.com';
        dto.method = 'GET';
        dto.jsonData = { test: 'data' };
        dto.port = port as number;
        dto.timeout = 5000;
        dto.ipAddress = '192.168.1.1';

        const errors = await validate(dto);
        const portErrors = errors.filter(e => e.property === 'port');
        expect(portErrors).toHaveLength(0);
      }
    });

    it('should reject invalid ports', async () => {
      const invalidPorts = [0, -1, 65536, 100000, 'invalid', null];

      for (const port of invalidPorts) {
        const dto = new TestValidationDto();
        dto.path = '/api/test';
        dto.url = 'https://example.com';
        dto.method = 'GET';
        dto.jsonData = { test: 'data' };
        dto.port = port as number;
        dto.timeout = 5000;
        dto.ipAddress = '192.168.1.1';

        const errors = await validate(dto);
        const portErrors = errors.filter(e => e.property === 'port');
        expect(portErrors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('IsIpAddress', () => {
    it('should validate IP addresses', async () => {
      const validIPs = [
        '192.168.1.1',
        '127.0.0.1',
        '10.0.0.1',
        '::1',
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      ];

      for (const ip of validIPs) {
        const dto = new TestValidationDto();
        dto.path = '/api/test';
        dto.url = 'https://example.com';
        dto.method = 'GET';
        dto.jsonData = { test: 'data' };
        dto.port = 3000;
        dto.timeout = 5000;
        dto.ipAddress = ip;

        const errors = await validate(dto);
        const ipErrors = errors.filter(e => e.property === 'ipAddress');
        expect(ipErrors).toHaveLength(0);
      }
    });

    it('should reject invalid IP addresses', async () => {
      const invalidIPs = [
        '256.256.256.256',
        '192.168.1',
        'not-an-ip',
        '192.168.1.1.1',
        123,
      ];

      for (const ip of invalidIPs) {
        const dto = new TestValidationDto();
        dto.path = '/api/test';
        dto.url = 'https://example.com';
        dto.method = 'GET';
        dto.jsonData = { test: 'data' };
        dto.port = 3000;
        dto.timeout = 5000;
        dto.ipAddress = ip as string;

        const errors = await validate(dto);
        const ipErrors = errors.filter(e => e.property === 'ipAddress');
        expect(ipErrors.length).toBeGreaterThan(0);
      }
    });
  });
});