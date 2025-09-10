# Design Document - Review Service MVP

## Overview

Review Service - базовый сервис отзывов для MVP российской игровой платформы. Позволяет пользователям оставлять простые отзывы на игры и просматривать мнения других.

**Технологический стек:** NestJS + TypeScript + PostgreSQL + Redis (основной стек для бизнес-логики)

## Architecture

### System Architecture

```mermaid
graph TB
    subgraph "Client"
        Web[Web Frontend]
    end
    
    subgraph "API Gateway"
        Gateway[API Gateway]
    end
    
    subgraph "Review Service (NestJS)"
        ReviewController[Review Controller]
        RatingController[Rating Controller]
        ReviewService[Review Service]
        RatingService[Rating Service]
        OwnershipService[Ownership Service]
        AuthGuard[JWT Auth Guard]
        ValidationPipe[Validation Pipe]
    end
    
    subgraph "External Services"
        LibraryService[Library Service]
    end
    
    subgraph "Database"
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis Cache)]
    end
    
    Web --> Gateway
    Gateway --> ReviewController
    Gateway --> RatingController
    ReviewController --> AuthGuard
    RatingController --> AuthGuard
    AuthGuard --> ValidationPipe
    ReviewController --> ReviewService
    RatingController --> RatingService
    ReviewService --> OwnershipService
    OwnershipService --> LibraryService
    ReviewService --> PostgreSQL
    RatingService --> PostgreSQL
    RatingService --> Redis
```

## NestJS Architecture

### Module Structure

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Review, GameRating]),
    HttpModule,
    CacheModule.register(),
  ],
  controllers: [ReviewController, RatingController],
  providers: [
    ReviewService,
    RatingService,
    OwnershipService,
  ],
  exports: [ReviewService, RatingService],
})
export class ReviewModule {}
```

### Controllers

```typescript
@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @UsePipes(ValidationPipe)
  async createReview(@Request() req, @Body() createDto: CreateReviewDto) {
    return this.reviewService.createReview(req.user.id, createDto);
  }

  @Get('game/:gameId')
  async getGameReviews(@Param('gameId') gameId: string, @Query() query: PaginationDto) {
    return this.reviewService.getGameReviews(gameId, query);
  }

  @Put(':id')
  @UsePipes(ValidationPipe)
  async updateReview(@Param('id') id: string, @Request() req, @Body() updateDto: UpdateReviewDto) {
    return this.reviewService.updateReview(id, req.user.id, updateDto);
  }

  @Delete(':id')
  async deleteReview(@Param('id') id: string, @Request() req) {
    return this.reviewService.deleteReview(id, req.user.id);
  }
}

@Controller('ratings')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Get('game/:gameId')
  @UseInterceptors(CacheInterceptor)
  async getGameRating(@Param('gameId') gameId: string) {
    return this.ratingService.getGameRating(gameId);
  }
}
```

## Components and Interfaces

### REST API Endpoints

#### Reviews
- `POST /reviews` - Создать отзыв
- `GET /reviews/game/:gameId` - Отзывы на игру с пагинацией
- `PUT /reviews/:id` - Обновить отзыв
- `DELETE /reviews/:id` - Удалить отзыв
- `GET /reviews/user/:userId` - Отзывы пользователя

#### Ratings
- `GET /ratings/game/:gameId` - Рейтинг игры (кешируется)

### Services

#### ReviewService
- `createReview(userId, createDto)` - Создать отзыв с проверкой владения
- `getGameReviews(gameId, pagination)` - Отзывы на игру с пагинацией
- `updateReview(reviewId, userId, updateDto)` - Обновить отзыв с проверкой прав
- `deleteReview(reviewId, userId)` - Удалить отзыв с проверкой прав
- `getUserReviews(userId)` - Отзывы пользователя

#### RatingService
- `calculateGameRating(gameId)` - Рассчитать рейтинг игры
- `updateGameRating(gameId)` - Обновить рейтинг игры
- `getGameRating(gameId)` - Получить рейтинг игры (с кешированием)

#### OwnershipService
- `checkGameOwnership(userId, gameId)` - Проверить владение игрой через Library Service

## Data Models

### Review Entity

```typescript
@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  gameId: string;

  @Column('text')
  text: string;

  @Column('int', { minimum: 1, maximum: 5 })
  rating: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Index(['gameId'])
  @Index(['userId'])
  @Index(['gameId', 'userId'], { unique: true })
}
```

### GameRating Entity

```typescript
@Entity('game_ratings')
export class GameRating {
  @PrimaryColumn()
  gameId: string;

  @Column('decimal', { precision: 3, scale: 2 })
  averageRating: number;

  @Column('int')
  totalReviews: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### DTOs

```typescript
export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsString()
  @Length(10, 1000)
  text: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}

export class UpdateReviewDto {
  @IsOptional()
  @IsString()
  @Length(10, 1000)
  text?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
```

## Error Handling

### Error Types
- `ValidationError` - Ошибки валидации данных
- `ReviewNotFoundError` - Отзыв не найден
- `DuplicateReviewError` - Отзыв уже существует
- `UnauthorizedError` - Нет прав на действие
- `GameOwnershipError` - Пользователь не владеет игрой
- `ExternalServiceError` - Ошибка внешнего сервиса

### Error Response Format

```json
{
  "error": {
    "code": "GAME_OWNERSHIP_ERROR",
    "message": "You must own the game to leave a review",
    "details": {}
  }
}
```

## Testing Strategy

### Unit Tests
- ReviewService методы
- RatingService методы
- OwnershipService методы
- Валидация DTO классов

### Integration Tests
- REST API endpoints
- Database операции TypeORM
- Расчет рейтингов
- Интеграция с Library Service

### Test Coverage
- Минимум 80% покрытие кода
- Все критические пути покрыты тестами