import { validateKPP } from 'russian-requisites-validator';

export class KPP {
  private readonly value: string;

  constructor(kpp: string) {
    if (!validateKPP(kpp)) {
      throw new Error('Invalid KPP format');
    }
    this.value = kpp;
  }

  equals(other: KPP): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }
}
