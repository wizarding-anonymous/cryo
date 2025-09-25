import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('JWT token is required');
    }

    try {
      // For MVP, we'll use a simple token validation
      // In production, this would use proper JWT verification with a secret key
      const payload = this.validateToken(token);
      
      // Attach user info to request
      (request as AuthenticatedRequest).user = {
        id: payload.sub,
        email: payload.email,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired JWT token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private validateToken(token: string): JwtPayload {
    // For MVP, we'll use a simple token format: base64(userId:email:timestamp)
    // In production, this would use proper JWT library like jsonwebtoken
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [userId, email, timestamp] = decoded.split(':');
      
      if (!userId || !email || !timestamp) {
        throw new Error('Invalid token format');
      }

      // Check if token is not expired (24 hours)
      const tokenTime = parseInt(timestamp);
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (now - tokenTime > twentyFourHours) {
        throw new Error('Token expired');
      }

      return {
        sub: userId,
        email,
        iat: tokenTime,
        exp: tokenTime + twentyFourHours,
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}