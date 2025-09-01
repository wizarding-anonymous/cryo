export class OGRN {
  private readonly value: string;

  constructor(ogrn: string) {
    if (!this.isValidOGRN(ogrn)) {
      throw new Error('Invalid OGRN format');
    }
    this.value = ogrn;
  }

  private isValidOGRN(ogrn: string): boolean {
    // Простая валидация ОГРН (13 или 15 цифр)
    if (!ogrn || typeof ogrn !== 'string') {
      return false;
    }

    const cleanOgrn = ogrn.replace(/\D/g, '');
    return cleanOgrn.length === 13 || cleanOgrn.length === 15;
  }

  equals(other: OGRN): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }
}
