import { validate } from 'class-validator';
import { IsPasswordStrong } from './password-strength.validator';

class TestDto {
  @IsPasswordStrong({
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    allowedSpecialChars: '@$!%*?&',
  })
  password: string;
}

describe('PasswordStrengthValidator', () => {
  let testDto: TestDto;

  beforeEach(() => {
    testDto = new TestDto();
  });

  describe('Valid passwords', () => {
    it('should pass validation for strong password', async () => {
      testDto.password = 'StrongPass123!';
      const errors = await validate(testDto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation for password with all required elements', async () => {
      testDto.password = 'MySecure@Pass1';
      const errors = await validate(testDto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation for longer password', async () => {
      testDto.password = 'VeryLongAndSecurePassword123!';
      const errors = await validate(testDto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Invalid passwords', () => {
    it('should fail validation for short password', async () => {
      testDto.password = 'Short1!';
      const errors = await validate(testDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.passwordStrength).toContain('не менее 8 символов');
    });

    it('should fail validation for password without uppercase', async () => {
      testDto.password = 'lowercase123!';
      const errors = await validate(testDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.passwordStrength).toContain('заглавные буквы');
    });

    it('should fail validation for password without lowercase', async () => {
      testDto.password = 'UPPERCASE123!';
      const errors = await validate(testDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.passwordStrength).toContain('строчные буквы');
    });

    it('should fail validation for password without numbers', async () => {
      testDto.password = 'NoNumbers!';
      const errors = await validate(testDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.passwordStrength).toContain('цифры');
    });

    it('should fail validation for password without special characters', async () => {
      testDto.password = 'NoSpecialChars123';
      const errors = await validate(testDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.passwordStrength).toContain('специальные символы');
    });

    it('should fail validation for empty password', async () => {
      testDto.password = '';
      const errors = await validate(testDto);
      expect(errors).toHaveLength(1);
    });

    it('should fail validation for null password', async () => {
      testDto.password = null as any;
      const errors = await validate(testDto);
      expect(errors).toHaveLength(1);
    });
  });

  describe('Custom options', () => {
    class CustomTestDto {
      @IsPasswordStrong({
        minLength: 6,
        requireUppercase: false,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
      })
      password: string;
    }

    it('should respect custom validation options', async () => {
      const customDto = new CustomTestDto();
      customDto.password = 'simple123'; // 8 chars, lowercase, numbers, no uppercase/special
      const errors = await validate(customDto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with custom options when requirements not met', async () => {
      const customDto = new CustomTestDto();
      customDto.password = 'short'; // Too short, no numbers
      const errors = await validate(customDto);
      expect(errors).toHaveLength(1);
    });
  });
});