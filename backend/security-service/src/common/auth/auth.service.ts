import { Injectable } from '@nestjs/common';
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface AuthUser {
  id?: string;
  email?: string;
  roles?: string[];
  isAdmin?: boolean;
  [key: string]: any;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async verifyBearerToken(authHeader?: string): Promise<AuthUser | null> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const secret = this.config.get<string>('JWT_SECRET');
    const publicKey = this.config.get<string>('JWT_PUBLIC_KEY');
    const opts: JwtVerifyOptions = publicKey
      ? { algorithms: ['RS256'], publicKey }
      : { algorithms: ['HS256'], secret };
    try {
      const payload = await this.jwt.verifyAsync(token, opts as any);
      return payload as AuthUser;
    } catch (_e) {
      return null;
    }
  }
}
