import { Request } from 'express';

export interface AuthRequest extends Request {
  user: {
    userId: string;
    // Other user properties can be added here as needed
  };
}
