import { validateAccount } from 'russian-requisites-validator';
import { BIK } from './bik.value-object';

export class BankAccount {
  private readonly value: string;

  constructor(account: string, bik: BIK) {
    if (!validateAccount(account, bik.getValue())) {
      throw new Error('Invalid Bank Account format or checksum');
    }
    this.value = account;
  }

  equals(other: BankAccount): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }
}
