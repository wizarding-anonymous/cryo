import { Email } from '../value-objects/email.value-object';
import { Password } from '../value-objects/password.value-object';
import { Username } from '../value-objects/username.value-object';

export interface IUser {
  id: string;
  email: Email;
  username: Username;
  password: Password;
  isActive: boolean;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}
