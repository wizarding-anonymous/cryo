import {
  Controller,
  Post,
  Body,
  Req,
  Param,
  Delete,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { FriendsQueryDto } from './dto/friends-query.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { AuthRequest } from '../common/interfaces/auth-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { FriendDto } from './dto/friend.dto';
import { FriendsResponseDto } from './dto/friends-response.dto';
import { UserSearchResultDto } from './dto/user-search-result.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiTags('Friends')
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post('request')
  @ApiOperation({ summary: 'Send a friend request' })
  @ApiCreatedResponse({ type: FriendDto })
  async sendFriendRequest(
    @Req() req: AuthRequest,
    @Body() dto: SendFriendRequestDto,
  ): Promise<FriendDto> {
    const fromUserId = req.user.userId;
    return this.friendsService.sendFriendRequest(fromUserId, dto.toUserId);
  }

  @Post('accept/:requestId')
  @ApiOperation({ summary: 'Accept a friend request' })
  @ApiOkResponse({ type: FriendDto })
  async acceptFriendRequest(
    @Req() req: AuthRequest,
    @Param('requestId') requestId: string,
  ): Promise<FriendDto> {
    const userId = req.user.userId;
    return this.friendsService.acceptFriendRequest(requestId, userId);
  }

  @Post('decline/:requestId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Decline a friend request' })
  @ApiNoContentResponse()
  async declineFriendRequest(
    @Req() req: AuthRequest,
    @Param('requestId') requestId: string,
  ): Promise<void> {
    const userId = req.user.userId;
    await this.friendsService.declineFriendRequest(requestId, userId);
  }

  @Delete(':friendId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a friend' })
  @ApiNoContentResponse()
  async removeFriend(@Req() req: AuthRequest, @Param('friendId') friendId: string): Promise<void> {
    const userId = req.user.userId;
    await this.friendsService.removeFriend(userId, friendId);
  }

  @Get()
  @ApiOperation({ summary: 'Get friends list' })
  @ApiOkResponse({ type: FriendsResponseDto })
  async getFriends(
    @Req() req: AuthRequest,
    @Query() query: FriendsQueryDto,
  ): Promise<FriendsResponseDto> {
    const userId = req.user.userId;
    return this.friendsService.getFriends(userId, query);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get pending friend requests' })
  @ApiOkResponse({ type: [FriendDto] })
  async getFriendRequests(@Req() req: AuthRequest): Promise<FriendDto[]> {
    const userId = req.user.userId;
    return this.friendsService.getFriendRequests(userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search for users by username' })
  @ApiOkResponse({ type: [UserSearchResultDto] })
  async searchUsers(
    @Req() req: AuthRequest,
    @Query('q') query: string,
  ): Promise<UserSearchResultDto[]> {
    const userId = req.user.userId;
    return this.friendsService.searchUsers(query, userId);
  }

  @Get('internal/:userId/list')
  @UseGuards(InternalAuthGuard)
  @ApiOperation({ summary: 'Internal: Get friends list for specified user (Review Service)' })
  @ApiOkResponse({ type: FriendsResponseDto })
  async internalGetFriends(
    @Param('userId') userId: string,
    @Query() query: FriendsQueryDto,
  ): Promise<FriendsResponseDto> {
    return this.friendsService.getFriends(userId, query);
  }
}
