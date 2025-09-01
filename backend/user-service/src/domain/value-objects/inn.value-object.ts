export class INN {
  private readonly value: string;

  constructor(inn: string) {
    if (!this.isValidINN(inn)) {
      throw new Error('Invalid INN format');
    }
    this.value = inn;
  }

  private isValidINN(inn: string): boolean {
    // Простая валидация ИНН (10 или 12 цифр)
    if (!inn || typeof inn !== 'string') {
      return false;
    }

    const cleanInn = inn.replace(/\D/g, '');
    return cleanInn.length === 10 || cleanInn.length === 12;
  }

  equals(other: INN): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }
}
