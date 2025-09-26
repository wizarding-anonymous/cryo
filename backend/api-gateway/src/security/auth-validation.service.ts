import { Injectable, UnauthorizedException } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { ServiceRegistryService } from '../registry/service-registry.service';
import type { User } from '../common/models/user.interface';

@Injectable()
export class AuthValidationService {
  constructor(private readonly registry: ServiceRegistryService) {}

  async validateBearerToken(authHeader?: string): Promise<User> {
    const token = this.extractTokenFromHeader(authHeader);
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const userService = this.registry.getServiceConfig('user-service');
    if (!userService) {
      throw new UnauthorizedException('User service is not configured');
    }

    const url = `${userService.baseUrl.replace(/\/$/, '')}/api/profile`;
    try {
      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: userService.timeout,
        validateStatus: () => true,
      });
      if (resp.status !== 200 || !resp.data) {
        throw new UnauthorizedException('Invalid token');
      }

      const data = resp.data;
      const user: User = {
        id: String(data.id ?? data.userId ?? ''),
        email: String(data.email ?? ''),
        roles: Array.isArray(data.roles) ? data.roles : [],
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
      };
      if (!user.id) {
        throw new UnauthorizedException('Invalid token payload');
      }
      return user;
    } catch (err) {
      const e = err as AxiosError;
      if (e.response && e.response.status === 401) {
        throw new UnauthorizedException('Unauthorized');
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }

  extractTokenFromHeader(authHeader?: string): string | undefined {
    if (!authHeader) return undefined;
    const [scheme, token] = authHeader.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token)
      return undefined;
    return token;
  }
}
