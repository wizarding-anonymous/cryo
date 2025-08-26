export class Username {
  private readonly value: string;

  private static readonly FORBIDDEN_USERNAMES = ['admin', 'root', 'administrator', 'superuser'];

  constructor(username: string) {
    this.validate(username);
    this.value = this.normalize(username);
  }

  private validate(username: string): void {
    if (username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }
    if (username.length > 50) {
      throw new Error('Username cannot be more than 50 characters long');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
    }
    if (Username.FORBIDDEN_USERNAMES.includes(username.toLowerCase())) {
      throw new Error('This username is forbidden');
    }
  }

  private normalize(username: string): string {
    return username.toLowerCase().trim();
  }

  equals(other: Username): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }
}
