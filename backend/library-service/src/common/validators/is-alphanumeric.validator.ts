import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsAlphanumericConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    return /^[a-zA-Z0-9]+$/.test(value);
  }

  defaultMessage(args: ValidationArguments) {
    return '($value) must contain only letters and numbers.';
  }
}

export function IsAlphanumeric(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAlphanumericConstraint,
    });
  };
}
