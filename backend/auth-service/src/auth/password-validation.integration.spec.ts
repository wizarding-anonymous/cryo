import { ValidationPipe } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { validate } from 'class-validator';

describe('Password Validation Integration', () => {

  describe('RegisterDto Password Validation', () => {
    it('should accept valid strong password', async () => {
      const registerDto = new RegisterDto();
      registerDto.name = 'Test User';
      registerDto.email = 'test@example.com';
      registerDto.password = 'StrongPass123!';

      const errors = await validate(registerDto);
      expect(errors).toHaveLength(0);
    });

    it('should reject weak passwords with detailed Russian error messages', async () => {
      const testCases = [
        {
          password: 'short',
          expectedError: 'не менее 8 символов',
        },
        {
          password: 'nouppercase123!',
          expectedError: 'заглавные буквы',
        },
        {
          password: 'NOLOWERCASE123!',
          expectedError: 'строчные буквы',
        },
        {
          password: 'NoNumbers!',
          expectedError: 'цифры',
        },
        {
          password: 'NoSpecialChars123',
          expectedError: 'специальные символы',
        },
      ];

      for (const testCase of testCases) {
        const registerDto = new RegisterDto();
        registerDto.name = 'Test User';
        registerDto.email = 'test@example.com';
        registerDto.password = testCase.password;

        const errors = await validate(registerDto);
        expect(errors.length).toBeGreaterThan(0);
        
        const passwordError = errors.find(error => 
          error.property === 'password' && 
          error.constraints?.passwordStrength
        );
        
        expect(passwordError).toBeDefined();
        expect(passwordError?.constraints?.passwordStrength).toContain(testCase.expectedError);
      }
    });

    it('should validate all password requirements in Russian', async () => {
      const registerDto = new RegisterDto();
      registerDto.name = 'Test User';
      registerDto.email = 'test@example.com';
      registerDto.password = 'weak'; // Fails all requirements

      const errors = await validate(registerDto);
      expect(errors.length).toBeGreaterThan(0);
      
      const passwordError = errors.find(error => error.property === 'password');
      expect(passwordError).toBeDefined();
      
      const errorMessage = passwordError?.constraints?.passwordStrength;
      expect(errorMessage).toContain('не менее 8 символов');
      expect(errorMessage).toContain('заглавные буквы');
      expect(errorMessage).toContain('строчные буквы');
      expect(errorMessage).toContain('цифры');
      expect(errorMessage).toContain('специальные символы');
      expect(errorMessage).toContain('@$!%*?&');
    });

    it('should accept various strong password formats', async () => {
      const strongPasswords = [
        'MyPassword123!',
        'Secure@Pass1',
        'Complex$Word9',
        'Valid&Strong8',
        'Test%Password2',
        'Super*Secret7',
        'Amazing?Code4',
      ];

      for (const password of strongPasswords) {
        const registerDto = new RegisterDto();
        registerDto.name = 'Test User';
        registerDto.email = 'test@example.com';
        registerDto.password = password;

        const errors = await validate(registerDto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should handle empty and null password values', async () => {
      const registerDto = new RegisterDto();
      registerDto.name = 'Test User';
      registerDto.email = 'test@example.com';
      registerDto.password = '';

      const errors = await validate(registerDto);
      expect(errors.length).toBeGreaterThan(0);
      
      const emptyError = errors.find(error => 
        error.property === 'password' && 
        error.constraints?.isNotEmpty
      );
      expect(emptyError?.constraints?.isNotEmpty).toBe('Пароль не может быть пустым');
    });
  });

  describe('Validation Pipe Integration', () => {
    it('should work with NestJS ValidationPipe', async () => {
      const validationPipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });

      const validDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'StrongPass123!',
      };

      const result = await validationPipe.transform(validDto, {
        type: 'body',
        metatype: RegisterDto,
      });

      expect(result).toBeInstanceOf(RegisterDto);
      expect(result.name).toBe('Test User');
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('StrongPass123!');
    });
  });
});