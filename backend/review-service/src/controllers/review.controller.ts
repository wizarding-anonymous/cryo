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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReviewService } from '../services/review.service';
import { CreateReviewDto, UpdateReviewDto, PaginationDto } from '../dto';
import { Review } from '../entities/review.entity';
import { JwtAuthGuard, OwnershipGuard } from '../guards';
import type { AuthenticatedRequest } from '../guards';

@ApiTags('reviews')
@Controller('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new review' })
  @ApiBody({ type: CreateReviewDto })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully',
    type: Review,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not own the game or already reviewed it',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async createReview(
    @Request() req: AuthenticatedRequest,
    @Body() createReviewDto: CreateReviewDto,
  ): Promise<Review> {
    return this.reviewService.createReview(req.user.id, createReviewDto);
  }

  @Get('game/:gameId')
  @ApiOperation({ summary: 'Get reviews for a specific game' })
  @ApiParam({
    name: 'gameId',
    description: 'ID of the game to get reviews for',
    type: 'string',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    type: 'number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of reviews per page (default: 10, max: 50)',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'Reviews retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        reviews: {
          type: 'array',
          items: { $ref: '#/components/schemas/Review' },
        },
        total: {
          type: 'number',
          description: 'Total number of reviews for this game',
        },
      },
    },
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getGameReviews(
    @Param('gameId') gameId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<{ reviews: Review[]; total: number }> {
    return this.reviewService.getGameReviews(gameId, paginationDto);
  }

  @Put(':id')
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Update an existing review' })
  @ApiParam({
    name: 'id',
    description: 'ID of the review to update',
    type: 'string',
  })
  @ApiBody({ type: UpdateReviewDto })
  @ApiResponse({
    status: 200,
    description: 'Review updated successfully',
    type: Review,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 403,
    description: 'User can only update their own reviews',
  })
  @ApiResponse({
    status: 404,
    description: 'Review not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateReview(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() updateReviewDto: UpdateReviewDto,
  ): Promise<Review> {
    return this.reviewService.updateReview(id, req.user.id, updateReviewDto);
  }

  @Delete(':id')
  @UseGuards(OwnershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a review' })
  @ApiParam({
    name: 'id',
    description: 'ID of the review to delete',
    type: 'string',
  })
  @ApiResponse({
    status: 204,
    description: 'Review deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User can only delete their own reviews',
  })
  @ApiResponse({
    status: 404,
    description: 'Review not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async deleteReview(@Param('id') id: string, @Request() req: AuthenticatedRequest): Promise<void> {
    return this.reviewService.deleteReview(id, req.user.id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get reviews by a specific user' })
  @ApiParam({
    name: 'userId',
    description: 'ID of the user to get reviews for',
    type: 'string',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    type: 'number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of reviews per page (default: 10, max: 50)',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'User reviews retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        reviews: {
          type: 'array',
          items: { $ref: '#/components/schemas/Review' },
        },
        total: {
          type: 'number',
          description: 'Total number of reviews by this user',
        },
      },
    },
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getUserReviews(
    @Param('userId') userId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<{ reviews: Review[]; total: number }> {
    return this.reviewService.getUserReviews(userId, paginationDto);
  }
}