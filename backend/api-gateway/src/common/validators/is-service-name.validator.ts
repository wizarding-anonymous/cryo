import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { ServiceName } from '../enums/service-name.enum';

export function IsServiceName(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsServiceName',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          return Object.values(ServiceName).includes(value as ServiceName);
        },
        defaultMessage(args: ValidationArguments) {
          const validServices = Object.values(ServiceName).join(', ');
          return `${args.property} must be one of: ${validServices}`;
        },
      },
    });
  };
}