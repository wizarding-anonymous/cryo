import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsAlphanumericConstraint implements ValidatorConstraintInterface {
  validate(value: any, _args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    return /^[a-zA-Z0-9]+$/.test(value);
  }

  defaultMessage(_args: ValidationArguments) {
    return '($value) must contain only letters and numbers.';
  }
}

export function IsAlphanumeric(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAlphanumericConstraint,
    });
  };
}
