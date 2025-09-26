import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsPort(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsPort',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value === 'string') {
            // Check if string contains only digits (no decimals, no other characters)
            if (!/^\d+$/.test(value.trim())) {
              return false;
            }
            const num = parseInt(value, 10);
            return !isNaN(num) && num >= 1 && num <= 65535;
          }
          if (typeof value === 'number') {
            return Number.isInteger(value) && value >= 1 && value <= 65535;
          }
          return false;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid port number (1-65535)`;
        },
      },
    });
  };
}