import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Email } from '../value-objects/email.value-object';
import { Password } from '../value-objects/password.value-object';
import { Username } from '../value-objects/username.value-object';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'password_hash' })
  passwordHash: string;

  // --- Domain Logic ---
  private _emailVO: Email;
  private _usernameVO: Username;
  private _passwordVO: Password;

  // Private constructor for TypeORM and factories
  private constructor() {}

  public static create(id: string, email: Email, username: Username, password: Password): User {
    const user = new User();
    user.id = id;
    user.setEmail(email);
    user.setUsername(username);
    user.setPassword(password);

    // Set defaults
    user.emailVerified = false;
    user.phoneVerified = false;
    user.profile = {};
    user.privacySettings = {};
    user.notificationSettings = {};
    user.mfaEnabled = false;
    user.mfaMethods = [];
    user.isActive = true;
    user.isBlocked = false;
    user.reputationScore = 0;

    return user;
  }

  public getEmail(): Email {
    if (!this._emailVO) {
      this._emailVO = new Email(this.email);
    }
    return this._emailVO;
  }

  public setEmail(email: Email): void {
    this._emailVO = email;
    this.email = email.getValue();
  }

  public getUsername(): Username {
    if (!this._usernameVO) {
      this._usernameVO = new Username(this.username);
    }
    return this._usernameVO;
  }

  public setUsername(username: Username): void {
    this._usernameVO = username;
    this.username = username.getValue();
  }

  public getPassword(): Password {
    if (!this._passwordVO) {
      this._passwordVO = Password.fromHash(this.passwordHash);
    }
    return this._passwordVO;
  }

  public setPassword(password: Password): void {
    this._passwordVO = password;
    this.passwordHash = password.getValue();
  }

  // --- Other columns ---

  @Column({ type: 'boolean', default: false, name: 'email_verified' })
  emailVerified: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone_number' })
  phoneNumber?: string;

  @Column({ type: 'boolean', default: false, name: 'phone_verified' })
  phoneVerified: boolean;

  @Column({ type: 'jsonb', nullable: false, default: {} })
  profile: object;

  @Column({ type: 'jsonb', nullable: false, default: {}, name: 'privacy_settings' })
  privacySettings: object;

  @Column({ type: 'jsonb', nullable: false, default: {}, name: 'notification_settings' })
  notificationSettings: object;

  @Column({ type: 'boolean', default: false, name: 'mfa_enabled' })
  mfaEnabled: boolean;

  @Column({ type: 'jsonb', default: [], name: 'mfa_methods' })
  mfaMethods: object;

  @Column({ type: 'varchar', nullable: true, name: 'mfa_secret' })
  mfaSecret?: string;

  @Column({ type: 'text', array: true, nullable: true, name: 'backup_codes' })
  backupCodes?: string[];

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_blocked' })
  isBlocked: boolean;

  @Column({ type: 'text', nullable: true, name: 'block_reason' })
  blockReason?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'block_expires_at' })
  blockExpiresAt?: Date;

  @Column({ type: 'integer', default: 0, name: 'reputation_score' })
  reputationScore: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date;
}
