import { PasswordValidationService } from './password-validation.service';

describe('PasswordValidationService', () => {
  let service: PasswordValidationService;

  beforeEach(() => {
    service = new PasswordValidationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validatePassword', () => {
    it('should validate strong password correctly', () => {
      const result = service.validatePassword('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.strength).toBe('strong');
      expect(result.score).toBeGreaterThan(80);
    });

    it('should reject password that is too short', () => {
      const result = service.validatePassword('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Пароль должен содержать не менее 8 символов');
      expect(result.strength).toBe('weak');
    });

    it('should reject password without uppercase letters', () => {
      const result = service.validatePassword('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Пароль должен содержать заглавные буквы (A-Z)');
    });

    it('should reject password without lowercase letters', () => {
      const result = service.validatePassword('UPPERCASE123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Пароль должен содержать строчные буквы (a-z)');
    });

    it('should reject password without numbers', () => {
      const result = service.validatePassword('NoNumbers!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Пароль должен содержать цифры (0-9)');
    });

    it('should reject password without special characters', () => {
      const result = service.validatePassword('NoSpecialChars123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Пароль должен содержать специальные символы (@$!%*?&)');
    });

    it('should reject empty password', () => {
      const result = service.validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Пароль не может быть пустым');
      expect(result.strength).toBe('weak');
      expect(result.score).toBe(0);
    });

    it('should reject null password', () => {
      const result = service.validatePassword(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Пароль не может быть пустым');
    });

    it('should handle custom validation rules', () => {
      const result = service.validatePassword('simple123', {
        minLength: 6,
        requireUppercase: false,
        requireSpecialChars: false,
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should calculate higher score for longer passwords', () => {
      const shortResult = service.validatePassword('Pass123!');
      const longResult = service.validatePassword('VeryLongPassword123!');
      expect(longResult.score).toBeGreaterThanOrEqual(shortResult.score);
    });

    it('should calculate higher score for complex passwords', () => {
      const simpleResult = service.validatePassword('Password1!');
      const complexResult = service.validatePassword('ComplexPASS987$%^');
      expect(complexResult.score).toBeGreaterThanOrEqual(simpleResult.score);
    });

    it('should respect maximum length limit', () => {
      const longPassword = 'a'.repeat(200) + 'A1!';
      const result = service.validatePassword(longPassword, { maxLength: 128 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Пароль не может быть длиннее 128 символов');
    });
  });

  describe('getStrengthDescription', () => {
    it('should return correct descriptions in Russian', () => {
      expect(service.getStrengthDescription('weak')).toBe('Слабый пароль');
      expect(service.getStrengthDescription('medium')).toBe('Средний пароль');
      expect(service.getStrengthDescription('strong')).toBe('Сильный пароль');
    });
  });

  describe('checkCommonPatterns', () => {
    it('should detect sequential characters', () => {
      const warnings = service.checkCommonPatterns('password123');
      expect(warnings).toContain('Избегайте последовательных символов (123, abc)');
    });

    it('should detect repeated characters', () => {
      const warnings = service.checkCommonPatterns('passwordaaa');
      expect(warnings).toContain('Избегайте повторяющихся символов (aaa, 111)');
    });

    it('should detect keyboard patterns', () => {
      const warnings = service.checkCommonPatterns('qwerty123');
      expect(warnings).toContain('Избегайте клавиатурных последовательностей');
    });

    it('should detect Russian keyboard patterns', () => {
      const warnings = service.checkCommonPatterns('йцукен123');
      expect(warnings).toContain('Избегайте клавиатурных последовательностей');
    });

    it('should return empty array for good password', () => {
      const warnings = service.checkCommonPatterns('GoodPassword987!');
      expect(warnings).toHaveLength(0);
    });
  });
});