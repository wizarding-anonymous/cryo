import { Injectable } from '@nestjs/common';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
  score: number; // 0-100
}

export interface PasswordValidationRules {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  allowedSpecialChars: string;
  maxLength?: number;
}

@Injectable()
export class PasswordValidationService {
  private readonly defaultRules: PasswordValidationRules = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    allowedSpecialChars: '@$!%*?&',
    maxLength: 128,
  };

  /**
   * Validates password against security rules
   */
  validatePassword(
    password: string,
    rules: Partial<PasswordValidationRules> = {},
  ): PasswordValidationResult {
    const validationRules = { ...this.defaultRules, ...rules };
    const errors: string[] = [];
    let score = 0;

    if (!password || typeof password !== 'string') {
      return {
        isValid: false,
        errors: ['Пароль не может быть пустым'],
        strength: 'weak',
        score: 0,
      };
    }

    // Check minimum length
    if (password.length < validationRules.minLength) {
      errors.push(`Пароль должен содержать не менее ${validationRules.minLength} символов`);
    } else {
      score += 20;
    }

    // Check maximum length
    if (validationRules.maxLength && password.length > validationRules.maxLength) {
      errors.push(`Пароль не может быть длиннее ${validationRules.maxLength} символов`);
    }

    // Check for uppercase letters
    if (validationRules.requireUppercase) {
      if (!/[A-Z]/.test(password)) {
        errors.push('Пароль должен содержать заглавные буквы (A-Z)');
      } else {
        score += 20;
      }
    }

    // Check for lowercase letters
    if (validationRules.requireLowercase) {
      if (!/[a-z]/.test(password)) {
        errors.push('Пароль должен содержать строчные буквы (a-z)');
      } else {
        score += 20;
      }
    }

    // Check for numbers
    if (validationRules.requireNumbers) {
      if (!/\d/.test(password)) {
        errors.push('Пароль должен содержать цифры (0-9)');
      } else {
        score += 20;
      }
    }

    // Check for special characters
    if (validationRules.requireSpecialChars) {
      const specialCharRegex = new RegExp(
        `[${validationRules.allowedSpecialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`,
      );
      if (!specialCharRegex.test(password)) {
        errors.push(
          `Пароль должен содержать специальные символы (${validationRules.allowedSpecialChars})`,
        );
      } else {
        score += 20;
      }
    }

    // Additional scoring for complexity
    if (password.length >= 12) score += 5;
    if (password.length >= 16) score += 5;
    if (/[A-Z].*[A-Z]/.test(password)) score += 5; // Multiple uppercase
    if (/[a-z].*[a-z]/.test(password)) score += 5; // Multiple lowercase
    if (/\d.*\d/.test(password)) score += 5; // Multiple numbers
    
    // Check for multiple special characters
    const specialMatches = password.match(
      new RegExp(`[${validationRules.allowedSpecialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g'),
    );
    if (specialMatches && specialMatches.length > 1) score += 5;

    // Determine strength based on validity and score
    let strength: 'weak' | 'medium' | 'strong';
    if (errors.length > 0 || score < 60) {
      strength = 'weak';
    } else if (score < 85) {
      strength = 'medium';
    } else {
      strength = 'strong';
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score: Math.min(score, 100),
    };
  }

  /**
   * Get password strength description in Russian
   */
  getStrengthDescription(strength: 'weak' | 'medium' | 'strong'): string {
    switch (strength) {
      case 'weak':
        return 'Слабый пароль';
      case 'medium':
        return 'Средний пароль';
      case 'strong':
        return 'Сильный пароль';
      default:
        return 'Неизвестная сложность';
    }
  }

  /**
   * Check if password contains common patterns that should be avoided
   */
  checkCommonPatterns(password: string): string[] {
    const warnings: string[] = [];

    // Check for sequential characters (3 or more in sequence)
    if (/123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) {
      warnings.push('Избегайте последовательных символов (123, abc)');
    }

    // Check for repeated characters
    if (/(.)\1{2,}/.test(password)) {
      warnings.push('Избегайте повторяющихся символов (aaa, 111)');
    }

    // Check for keyboard patterns
    if (/qwerty|asdf|zxcv|йцукен|фыва|ячсм/i.test(password)) {
      warnings.push('Избегайте клавиатурных последовательностей');
    }

    return warnings;
  }
}