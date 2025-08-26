export class Email {
  private readonly value: string;

  constructor(email: string) {
    this.validate(email);
    this.value = this.normalize(email);
  }

  private validate(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
  }

  private normalize(email: string): string {
    return email.toLowerCase().trim();
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }

  getDomain(): string {
    return this.value.split('@')[1];
  }
}
