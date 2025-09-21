import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ReviewService } from '../services/review.service';
import { CreateReviewDto, UpdateReviewDto, PaginationDto } from '../dto';
import { JwtAuthGuard, OwnershipGuard } from '../guards';

@ApiTags('reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @ApiOperation({
    summary: 'Создать отзыв',
    description: 'Создает новый отзыв на игру. Пользователь должен владеть игрой.',
  })
  @ApiBody({ type: CreateReviewDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Отзыв успешно создан',
    schema: {
      example: {
        id: 'uuid',
        userId: 'user-uuid',
        gameId: 'game-uuid',
        text: 'Отличная игра!',
        rating: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Некорректные данные',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Пользователь не владеет игрой',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Отзыв уже существует',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async createReview(@Request() req, @Body() createReviewDto: CreateReviewDto) {
    return this.reviewService.createReview(req.user.id, createReviewDto);
  }

  @Get('game/:gameId')
  @ApiOperation({
    summary: 'Получить отзывы на игру',
    description: 'Возвращает список отзывов на игру с пагинацией',
  })
  @ApiParam({
    name: 'gameId',
    description: 'ID игры',
    type: 'string',
  })
  @ApiQuery({
    name: 'page',
    description: 'Номер страницы',
    required: false,
    type: 'number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Количество отзывов на странице',
    required: false,
    type: 'number',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список отзывов',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            userId: 'user-uuid',
            gameId: 'game-uuid',
            text: 'Отличная игра!',
            rating: 5,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Игра не найдена',
  })
  async getGameReviews(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.reviewService.getGameReviews(gameId, paginationDto);
  }

  @Put(':id')
  @UseGuards(OwnershipGuard)
  @ApiOperation({
    summary: 'Обновить отзыв',
    description: 'Обновляет существующий отзыв. Только автор может редактировать свой отзыв.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID отзыва',
    type: 'string',
  })
  @ApiBody({ type: UpdateReviewDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Отзыв успешно обновлен',
    schema: {
      example: {
        id: 'uuid',
        userId: 'user-uuid',
        gameId: 'game-uuid',
        text: 'Обновленный текст отзыва',
        rating: 4,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T01:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Некорректные данные',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Нет прав на редактирование отзыва',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Отзыв не найден',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    return this.reviewService.updateReview(id, req.user.id, updateReviewDto);
  }

  @Delete(':id')
  @UseGuards(OwnershipGuard)
  @ApiOperation({
    summary: 'Удалить отзыв',
    description: 'Удаляет отзыв. Только автор может удалить свой отзыв.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID отзыва',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Отзыв успешно удален',
    schema: {
      example: {
        message: 'Review deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Нет прав на удаление отзыва',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Отзыв не найден',
  })
  async deleteReview(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.reviewService.deleteReview(id, req.user.id);
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: 'Получить отзывы пользователя',
    description: 'Возвращает список отзывов пользователя с пагинацией',
  })
  @ApiParam({
    name: 'userId',
    description: 'ID пользователя',
    type: 'string',
  })
  @ApiQuery({
    name: 'page',
    description: 'Номер страницы',
    required: false,
    type: 'number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Количество отзывов на странице',
    required: false,
    type: 'number',
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Список отзывов пользователя',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            userId: 'user-uuid',
            gameId: 'game-uuid',
            text: 'Отличная игра!',
            rating: 5,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  async getUserReviews(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.reviewService.getUserReviews(userId, paginationDto);
  }
}