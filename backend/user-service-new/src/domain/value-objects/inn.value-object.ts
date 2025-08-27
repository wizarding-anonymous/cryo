import { validateINN } from 'russian-requisites-validator';

export class INN {
  private readonly value: string;

  constructor(inn: string) {
    if (!validateINN(inn)) {
      throw new Error('Invalid INN format');
    }
    this.value = inn;
  }

  equals(other: INN): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }
}
