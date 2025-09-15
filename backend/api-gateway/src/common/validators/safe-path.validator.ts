import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsSafePath(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'IsSafePath',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          if (!value.startsWith('/')) return false;
          if (value.includes('..')) return false;
          if (/\s/.test(value)) return false;
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be an absolute, safe path`;
        },
      },
    });
  };
}

