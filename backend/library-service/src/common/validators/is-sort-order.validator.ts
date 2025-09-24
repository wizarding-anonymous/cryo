import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsSortOrderConstraint implements ValidatorConstraintInterface {
  validate(value: any, _args: ValidationArguments) {
    if (typeof value !== 'string') return false;
    return ['asc', 'desc'].includes(value.toLowerCase());
  }

  defaultMessage(_args: ValidationArguments) {
    return '($value) must be either "asc" or "desc".';
  }
}

export function IsSortOrder(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSortOrderConstraint,
    });
  };
}
