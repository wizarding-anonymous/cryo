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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthRequest } from '../common/interfaces/auth-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiTags('Friends')
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post('request')
  @ApiOperation({ summary: 'Send a friend request' })
  async sendFriendRequest(
    @Req() req: AuthRequest,
    @Body() dto: SendFriendRequestDto,
  ) {
    // The design doc implies the user ID comes from the JWT payload
    const fromUserId = req.user.userId;
    return this.friendsService.sendFriendRequest(fromUserId, dto.toUserId);
  }

  @Post('accept/:requestId')
  @ApiOperation({ summary: 'Accept a friend request' })
  async acceptFriendRequest(
    @Req() req: AuthRequest,
    @Param('requestId') requestId: string,
  ) {
    const userId = req.user.userId;
    return this.friendsService.acceptFriendRequest(requestId, userId);
  }

  @Post('decline/:requestId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Decline a friend request' })
  async declineFriendRequest(
    @Req() req: AuthRequest,
    @Param('requestId') requestId: string,
  ) {
    const userId = req.user.userId;
    await this.friendsService.declineFriendRequest(requestId, userId);
  }

  @Delete(':friendId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a friend' })
  async removeFriend(
    @Req() req: AuthRequest,
    @Param('friendId') friendId: string,
  ) {
    const userId = req.user.userId;
    await this.friendsService.removeFriend(userId, friendId);
  }

  @Get()
  @ApiOperation({ summary: 'Get friends list' })
  async getFriends(@Req() req: AuthRequest, @Query() query: FriendsQueryDto) {
    const userId = req.user.userId;
    return this.friendsService.getFriends(userId, query);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get pending friend requests' })
  async getFriendRequests(@Req() req: AuthRequest) {
    const userId = req.user.userId;
    return this.friendsService.getFriendRequests(userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search for users by username' })
  async searchUsers(@Req() req: AuthRequest, @Query('q') query: string) {
    const userId = req.user.userId;
    // This is a placeholder; in a real app, it would call the user service.
    return this.friendsService.searchUsers(query, userId);
  }

  // Internal endpoint for Review Service to check social connections
  @Get('internal/:userId/list')
  @UseGuards(InternalAuthGuard)
  @ApiOperation({ summary: 'Internal: Get friends list for specified user (Review Service)' })
  async internalGetFriends(@Param('userId') userId: string, @Query() query: FriendsQueryDto) {
    return this.friendsService.getFriends(userId, query);
  }
}
