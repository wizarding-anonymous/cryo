import { validateOGRN } from 'russian-requisites-validator';

export class OGRN {
  private readonly value: string;

  constructor(ogrn: string) {
    if (!validateOGRN(ogrn)) {
      throw new Error('Invalid OGRN format');
    }
    this.value = ogrn;
  }

  equals(other: OGRN): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }
}
