import { ValueTransformer } from 'typeorm';

interface ValueObject<T> {
  getValue(): T;
  equals(other: ValueObject<T>): boolean;
}

// A generic transformer for any value object that has a getValue() method
// and a constructor that takes the primitive value.
export const ValueObjectTransformer = <T, V extends ValueObject<T>>(
  ValueObject: new (value: T) => V,
): ValueTransformer => {
  return {
    to: (value: V): T => {
      return value.getValue();
    },
    from: (value: T): V => {
      return new ValueObject(value);
    },
  };
};

// Special transformer for Password, as its constructor is private and needs a factory `fromHash`
interface PasswordValueObject {
  getValue(): string;
}
interface PasswordStatic {
  fromHash(hash: string): PasswordValueObject;
}
export const PasswordTransformer: ValueTransformer = {
  to: (value: PasswordValueObject): string => value.getValue(),
  from: (value: string): PasswordValueObject => {
    // We need to get the class dynamically, assuming it's available.
    // This is a bit of a hack due to circular dependencies, but it's a common pattern.
    const PasswordVO = require('../../../domain/value-objects/password.value-object').Password;
    return (PasswordVO as PasswordStatic).fromHash(value);
  },
};
