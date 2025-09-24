import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsPositiveNumberConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, _args: ValidationArguments) {
    const num = Number(value);
    return !isNaN(num) && num > 0 && isFinite(num);
  }

  defaultMessage(_args: ValidationArguments) {
    return '($value) must be a positive number greater than 0.';
  }
}

export function IsPositiveNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveNumberConstraint,
    });
  };
}
