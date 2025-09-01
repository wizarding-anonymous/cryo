import * as bcrypt from 'bcrypt';

export class Password {
  private readonly hashedValue: string;

  private constructor(hashedValue: string) {
    this.hashedValue = hashedValue;
  }

  public static async create(plainPassword: string): Promise<Password> {
    this.validateStrength(plainPassword);
    const hashedPassword = await this.hash(plainPassword);
    return new Password(hashedPassword);
  }

  public static fromHash(hashedPassword: string): Password {
    return new Password(hashedPassword);
  }

  private static validateStrength(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('Password must contain uppercase, lowercase and digit');
    }
  }

  private static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async compare(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.hashedValue);
  }

  equals(other: Password): boolean {
    return this.hashedValue === other.hashedValue;
  }

  getValue(): string {
    return this.hashedValue;
  }
}
