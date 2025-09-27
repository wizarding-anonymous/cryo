import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { HttpMethod } from '../enums/http-method.enum';

export function IsHttpMethod(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsHttpMethod',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          return Object.values(HttpMethod).includes(
            value.toUpperCase() as HttpMethod,
          );
        },
        defaultMessage(args: ValidationArguments) {
          const validMethods = Object.values(HttpMethod).join(', ');
          return `${args.property} must be one of: ${validMethods}`;
        },
      },
    });
  };
}
