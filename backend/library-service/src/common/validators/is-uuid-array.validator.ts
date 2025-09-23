import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { isUUID } from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsUuidArrayConstraint implements ValidatorConstraintInterface {
  validate(value: any, _args: ValidationArguments) {
    if (!Array.isArray(value)) return false;
    return value.every((item) => typeof item === 'string' && isUUID(item));
  }

  defaultMessage(_args: ValidationArguments) {
    return '($value) must be an array of valid UUIDs.';
  }
}

export function IsUuidArray(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUuidArrayConstraint,
    });
  };
}