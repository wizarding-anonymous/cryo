import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

export interface PasswordStrengthOptions {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  allowedSpecialChars?: string;
}

@ValidatorConstraint({ name: 'passwordStrength', async: false })
export class PasswordStrengthConstraint implements ValidatorConstraintInterface {
  validate(password: string, args: ValidationArguments) {
    if (!password || typeof password !== 'string') {
      return false;
    }

    const options: PasswordStrengthOptions = args.constraints[0] || {};
    const {
      minLength = 8,
      requireUppercase = true,
      requireLowercase = true,
      requireNumbers = true,
      requireSpecialChars = true,
      allowedSpecialChars = '@$!%*?&',
    } = options;

    // Check minimum length
    if (password.length < minLength) {
      return false;
    }

    // Check for uppercase letters
    if (requireUppercase && !/[A-Z]/.test(password)) {
      return false;
    }

    // Check for lowercase letters
    if (requireLowercase && !/[a-z]/.test(password)) {
      return false;
    }

    // Check for numbers
    if (requireNumbers && !/\d/.test(password)) {
      return false;
    }

    // Check for special characters
    if (requireSpecialChars) {
      const specialCharRegex = new RegExp(`[${allowedSpecialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
      if (!specialCharRegex.test(password)) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const options: PasswordStrengthOptions = args.constraints[0] || {};
    const {
      minLength = 8,
      requireUppercase = true,
      requireLowercase = true,
      requireNumbers = true,
      requireSpecialChars = true,
      allowedSpecialChars = '@$!%*?&',
    } = options;

    const requirements: string[] = [];
    
    requirements.push(`не менее ${minLength} символов`);
    
    if (requireUppercase) {
      requirements.push('заглавные буквы (A-Z)');
    }
    
    if (requireLowercase) {
      requirements.push('строчные буквы (a-z)');
    }
    
    if (requireNumbers) {
      requirements.push('цифры (0-9)');
    }
    
    if (requireSpecialChars) {
      requirements.push(`специальные символы (${allowedSpecialChars})`);
    }

    return `Пароль должен содержать: ${requirements.join(', ')}`;
  }
}

export function IsPasswordStrong(
  options?: PasswordStrengthOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: PasswordStrengthConstraint,
    });
  };
}