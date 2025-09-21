import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    // В MVP версии мы делаем простую проверку токена
    // В production версии здесь должна быть полная JWT валидация
    try {
      // Простая проверка формата токена для MVP
      if (!token.startsWith('Bearer_') && token.length < 10) {
        throw new UnauthorizedException('Invalid token format');
      }

      // Мокаем пользователя для MVP тестирования
      // В production версии здесь должна быть декодировка JWT токена
      request.user = {
        id: this.extractUserIdFromToken(token),
        // Другие поля пользователя будут добавлены при интеграции с Security Service
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractUserIdFromToken(token: string): string {
    // В MVP версии извлекаем ID из токена простым способом
    // В production версии здесь должна быть декодировка JWT
    
    // Для тестирования: если токен содержит user_id, извлекаем его
    if (token.includes('user_')) {
      const match = token.match(/user_([a-f0-9-]+)/);
      if (match) {
        return match[1];
      }
    }
    
    // Fallback для MVP тестирования
    return 'test-user-id';
  }
}