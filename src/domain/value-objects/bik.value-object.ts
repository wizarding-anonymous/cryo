import { validateBIK } from 'russian-requisites-validator';

export class BIK {
  private readonly value: string;

  constructor(bik: string) {
    if (!validateBIK(bik)) {
      throw new Error('Invalid BIK format');
    }
    this.value = bik;
  }

  equals(other: BIK): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }
}
