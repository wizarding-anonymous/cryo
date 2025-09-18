import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  Request,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto, PaginationDto } from './dto/review.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new review for a game' })
  @ApiResponse({ status: 201, description: 'Review created successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden. User must own the game.' })
  @ApiResponse({ status: 409, description: 'Conflict. A review for this game by this user already exists.' })
  @ApiBearerAuth()
  @UsePipes(new ValidationPipe())
  createReview(@Request() req, @Body() createReviewDto: CreateReviewDto) {
    return this.reviewsService.createReview(req.user.id, createReviewDto);
  }

  @Get('game/:gameId')
  @ApiOperation({ summary: 'Get all reviews for a specific game with pagination' })
  @ApiResponse({ status: 200, description: 'Returns a paginated list of reviews.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page.' })
  @UsePipes(new ValidationPipe({ transform: true }))
  getGameReviews(
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.reviewsService.getGameReviews(gameId, paginationDto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all reviews by a specific user with pagination' })
  @ApiResponse({ status: 200, description: 'Returns a paginated list of user reviews.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page.' })
  @UsePipes(new ValidationPipe({ transform: true }))
  getUserReviews(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.reviewsService.getUserReviews(userId, paginationDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update an existing review' })
  @ApiResponse({ status: 200, description: 'The review has been successfully updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden. You are not the owner of this review.' })
  @ApiResponse({ status: 404, description: 'Not Found. The review does not exist.' })
  @ApiBearerAuth()
  @UsePipes(new ValidationPipe())
  updateReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    return this.reviewsService.updateReview(id, req.user.id, updateReviewDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a review' })
  @ApiResponse({ status: 204, description: 'The review has been successfully deleted.' })
  @ApiResponse({ status: 403, description: 'Forbidden. You are not the owner of this review.' })
  @ApiResponse({ status: 404, description: 'Not Found. The review does not exist.' })
  @ApiBearerAuth()
  deleteReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.reviewsService.deleteReview(id, req.user.id);
  }
}
