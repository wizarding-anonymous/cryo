import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsJsonObject(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsJsonObject',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (value === null || value === undefined) return false;

          // Check if it's already an object
          if (typeof value === 'object' && !Array.isArray(value)) {
            return true;
          }

          // If it's a string, try to parse it as JSON
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              return (
                typeof parsed === 'object' &&
                !Array.isArray(parsed) &&
                parsed !== null
              );
            } catch {
              return false;
            }
          }

          return false;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid JSON object`;
        },
      },
    });
  };
}
