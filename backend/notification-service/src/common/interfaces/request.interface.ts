import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  isAdmin?: boolean;
  roles?: string[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
