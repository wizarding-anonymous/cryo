import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  let registerDto: RegisterDto;

  beforeEach(() => {
    registerDto = new RegisterDto();
  });

  describe('Valid registration data', () => {
    it('should pass validation with valid data', async () => {
      registerDto.name = 'John Doe';
      registerDto.email = 'john.doe@example.com';
      registerDto.password = 'StrongPass123!';

      const errors = await validate(registerDto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with different valid password', async () => {
      registerDto.name = 'Jane Smith';
      registerDto.email = 'jane.smith@example.com';
      registerDto.password = 'MySecure@Pass1';

      const errors = await validate(registerDto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Name validation', () => {
    beforeEach(() => {
      registerDto.email = 'test@example.com';
      registerDto.password = 'ValidPass123!';
    });

    it('should fail validation for empty name', async () => {
      registerDto.name = '';
      const errors = await validate(registerDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNotEmpty).toBe('Имя не может быть пустым');
    });

    it('should fail validation for too long name', async () => {
      registerDto.name = 'a'.repeat(101);
      const errors = await validate(registerDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.maxLength).toBe('Имя не может быть длиннее 100 символов');
    });

    it('should pass validation for maximum length name', async () => {
      registerDto.name = 'a'.repeat(100);
      const errors = await validate(registerDto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Email validation', () => {
    beforeEach(() => {
      registerDto.name = 'Test User';
      registerDto.password = 'ValidPass123!';
    });

    it('should fail validation for empty email', async () => {
      registerDto.email = '';
      const errors = await validate(registerDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNotEmpty).toBe('Email не может быть пустым');
    });

    it('should fail validation for invalid email format', async () => {
      registerDto.email = 'invalid-email';
      const errors = await validate(registerDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isEmail).toBe('Некорректный формат email');
    });

    it('should fail validation for too long email', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      registerDto.email = longEmail;
      const errors = await validate(registerDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.maxLength).toBe('Email не может быть длиннее 255 символов');
    });

    it('should pass validation for valid email formats', async () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
      ];

      for (const email of validEmails) {
        registerDto.email = email;
        const errors = await validate(registerDto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('Password validation', () => {
    beforeEach(() => {
      registerDto.name = 'Test User';
      registerDto.email = 'test@example.com';
    });

    it('should fail validation for empty password', async () => {
      registerDto.password = '';
      const errors = await validate(registerDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNotEmpty).toBe('Пароль не может быть пустым');
    });

    it('should fail validation for short password', async () => {
      registerDto.password = 'Short1!';
      const errors = await validate(registerDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.passwordStrength).toContain('не менее 8 символов');
    });

    it('should fail validation for password without uppercase', async () => {
      registerDto.password = 'lowercase123!';
      const errors = await validate(registerDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.passwordStrength).toContain('заглавные буквы');
    });

    it('should fail validation for password without lowercase', async () => {
      registerDto.password = 'UPPERCASE123!';
      const errors = await validate(registerDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.passwordStrength).toContain('строчные буквы');
    });

    it('should fail validation for password without numbers', async () => {
      registerDto.password = 'NoNumbers!';
      const errors = await validate(registerDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.passwordStrength).toContain('цифры');
    });

    it('should fail validation for password without special characters', async () => {
      registerDto.password = 'NoSpecialChars123';
      const errors = await validate(registerDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.passwordStrength).toContain('специальные символы');
    });

    it('should pass validation for strong passwords', async () => {
      const strongPasswords = [
        'StrongPass123!',
        'MySecure@Pass1',
        'Complex$Password9',
        'Valid&Strong8',
        'Test%Password2',
      ];

      for (const password of strongPasswords) {
        registerDto.password = password;
        const errors = await validate(registerDto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should fail validation for non-string password', async () => {
      registerDto.password = 123 as any;
      const errors = await validate(registerDto);
      expect(errors.length).toBeGreaterThan(0);
      const stringError = errors.find(error => error.constraints?.isString);
      expect(stringError?.constraints?.isString).toBe('Пароль должен быть строкой');
    });
  });

  describe('Multiple validation errors', () => {
    it('should return multiple errors for multiple invalid fields', async () => {
      registerDto.name = '';
      registerDto.email = 'invalid-email';
      registerDto.password = 'weak';

      const errors = await validate(registerDto);
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});