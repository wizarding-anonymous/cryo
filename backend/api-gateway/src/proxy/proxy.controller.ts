import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import {
  OptionalAuthGuard,
  JwtAuthGuard,
  RateLimitGuard,
} from '../security/guards';
import {
  LoggingInterceptor,
  ResponseInterceptor,
  CacheInterceptor,
  CorsInterceptor,
} from '../shared/interceptors';
import { JsonBodyValidationPipe } from '../common/pipes';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiParam,
  ApiHeader,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { ProxyResponseDto } from './dto/proxy-response.dto';

@Controller()
@UseGuards(RateLimitGuard)
@UseInterceptors(
  CorsInterceptor,
  LoggingInterceptor,
  ResponseInterceptor,
  CacheInterceptor,
)
@ApiTags('Proxy')
@ApiExtraModels(ErrorResponseDto, ProxyResponseDto)
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('*')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({
    summary: 'Проксирование GET запросов к микросервисам',
    description: `
      Проксирует GET запросы к соответствующим микросервисам на основе пути запроса.
      
      **Поддерживаемые маршруты:**
      - \`/api/games/*\` → Game Catalog Service
      - \`/api/users/profile\` → User Service (требует аутентификации)
      - \`/api/library/*\` → Library Service (требует аутентификации)
      - \`/api/social/*\` → Social Service (требует аутентификации)
      - \`/api/reviews/*\` → Review Service
      - \`/api/achievements/*\` → Achievement Service (требует аутентификации)
      
      **Примеры запросов:**
      - \`GET /api/games\` - получить список игр
      - \`GET /api/games/123\` - получить информацию об игре
      - \`GET /api/users/profile\` - получить профиль пользователя (требует JWT)
    `,
  })
  @ApiParam({
    name: 'path',
    description: 'Путь к ресурсу микросервиса',
    example: 'games',
    required: false,
  })
  @ApiHeader({
    name: 'Authorization',
    description:
      'JWT токен для аутентификации (опционально для публичных ресурсов)',
    required: false,
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @ApiResponse({
    status: 200,
    description: 'Успешный ответ от целевого микросервиса',
    content: {
      'application/json': {
        examples: {
          games: {
            summary: 'Список игр',
            value: {
              data: [
                { id: '1', title: 'Cyberpunk 2077', price: 1999 },
                { id: '2', title: 'The Witcher 3', price: 999 },
              ],
              total: 2,
              page: 1,
            },
          },
          userProfile: {
            summary: 'Профиль пользователя',
            value: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'user@example.com',
              username: 'gamer123',
              createdAt: '2024-01-15T10:30:00.000Z',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Не авторизован - требуется JWT токен',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: 'Ресурс не найден',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 429,
    description: 'Превышен лимит запросов',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 503,
    description: 'Целевой сервис недоступен',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async handleGetRequest(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<any> {
    const result = await this.proxyService.forward(request);
    response.status(result.statusCode);
    Object.entries(result.headers).forEach(([key, value]) => {
      response.header(key, value);
    });
    return response.send(result.body);
  }

  @Post('*')
  @UseGuards(JwtAuthGuard)
  @UsePipes(JsonBodyValidationPipe)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Проксирование POST запросов (требует аутентификации)',
    description: `
      Проксирует POST запросы к соответствующим микросервисам. Все POST запросы требуют JWT аутентификации.
      
      **Поддерживаемые маршруты:**
      - \`/api/users/*\` → User Service
      - \`/api/payments/*\` → Payment Service
      - \`/api/library/*\` → Library Service
      - \`/api/social/*\` → Social Service
      - \`/api/reviews/*\` → Review Service
      - \`/api/achievements/*\` → Achievement Service
      - \`/api/notifications/*\` → Notification Service
      
      **Примеры запросов:**
      - \`POST /api/payments/purchase\` - покупка игры
      - \`POST /api/reviews\` - создание отзыва
      - \`POST /api/social/friends/invite\` - отправка приглашения в друзья
    `,
  })
  @ApiParam({
    name: 'path',
    description: 'Путь к ресурсу микросервиса',
    example: 'payments/purchase',
    required: false,
  })
  @ApiResponse({
    status: 201,
    description: 'Ресурс успешно создан',
    content: {
      'application/json': {
        examples: {
          purchase: {
            summary: 'Успешная покупка',
            value: {
              id: 'purchase-123',
              gameId: 'game-456',
              amount: 1999,
              status: 'completed',
              createdAt: '2024-01-15T10:30:00.000Z',
            },
          },
          review: {
            summary: 'Созданный отзыв',
            value: {
              id: 'review-789',
              gameId: 'game-456',
              rating: 5,
              comment: 'Отличная игра!',
              createdAt: '2024-01-15T10:30:00.000Z',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректные данные запроса',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 401,
    description: 'Не авторизован - требуется JWT токен',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 403,
    description: 'Недостаточно прав доступа',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 429,
    description: 'Превышен лимит запросов',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async handlePostRequest(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<any> {
    const result = await this.proxyService.forward(request);
    response.status(result.statusCode);
    Object.entries(result.headers).forEach(([key, value]) => {
      response.header(key, value);
    });
    return response.send(result.body);
  }

  @Put('*')
  @UseGuards(JwtAuthGuard)
  @UsePipes(JsonBodyValidationPipe)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Проксирование PUT запросов (требует аутентификации)',
    description: `
      Проксирует PUT запросы к соответствующим микросервисам для обновления ресурсов.
      
      **Поддерживаемые маршруты:**
      - \`/api/users/profile\` → User Service
      - \`/api/library/*\` → Library Service
      - \`/api/social/*\` → Social Service
      - \`/api/reviews/*\` → Review Service
      
      **Примеры запросов:**
      - \`PUT /api/users/profile\` - обновление профиля пользователя
      - \`PUT /api/reviews/123\` - обновление отзыва
    `,
  })
  @ApiParam({
    name: 'path',
    description: 'Путь к ресурсу микросервиса',
    example: 'users/profile',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Ресурс успешно обновлен',
    content: {
      'application/json': {
        examples: {
          profile: {
            summary: 'Обновленный профиль',
            value: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'user@example.com',
              username: 'newusername',
              updatedAt: '2024-01-15T10:30:00.000Z',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректные данные запроса',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 401,
    description: 'Не авторизован - требуется JWT токен',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: 'Ресурс не найден',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async handlePutRequest(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<any> {
    const result = await this.proxyService.forward(request);
    response.status(result.statusCode);
    Object.entries(result.headers).forEach(([key, value]) => {
      response.header(key, value);
    });
    return response.send(result.body);
  }

  @Delete('*')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Проксирование DELETE запросов (требует аутентификации)',
    description: `
      Проксирует DELETE запросы к соответствующим микросервисам для удаления ресурсов.
      
      **Поддерживаемые маршруты:**
      - \`/api/library/*\` → Library Service
      - \`/api/social/*\` → Social Service
      - \`/api/reviews/*\` → Review Service
      
      **Примеры запросов:**
      - \`DELETE /api/library/games/123\` - удаление игры из библиотеки
      - \`DELETE /api/reviews/456\` - удаление отзыва
      - \`DELETE /api/social/friends/789\` - удаление из друзей
    `,
  })
  @ApiParam({
    name: 'path',
    description: 'Путь к ресурсу микросервиса',
    example: 'reviews/123',
    required: false,
  })
  @ApiResponse({
    status: 204,
    description: 'Ресурс успешно удален',
  })
  @ApiResponse({
    status: 401,
    description: 'Не авторизован - требуется JWT токен',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 403,
    description: 'Недостаточно прав доступа',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  @ApiResponse({
    status: 404,
    description: 'Ресурс не найден',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async handleDeleteRequest(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<any> {
    const result = await this.proxyService.forward(request);
    response.status(result.statusCode);
    Object.entries(result.headers).forEach(([key, value]) => {
      response.header(key, value);
    });
    return response.send(result.body);
  }
}
