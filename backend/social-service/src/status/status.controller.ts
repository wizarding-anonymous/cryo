import { Controller, Put, Body, Req, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { StatusService } from './status.service';
import { SetStatusDto } from './dto/set-status.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AuthRequest } from '../common/interfaces/auth-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FriendStatusDto } from './dto/friend-status.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiTags('Online Status')
@Controller('status')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Put('online')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Set the user's status to online" })
  @ApiNoContentResponse()
  async setOnlineStatus(@Req() req: AuthRequest, @Body() dto: SetStatusDto): Promise<void> {
    const userId = req.user.userId;
    await this.statusService.setOnlineStatus(userId, dto.currentGame);
  }

  @Put('offline')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Set the user's status to offline" })
  @ApiNoContentResponse()
  async setOfflineStatus(@Req() req: AuthRequest): Promise<void> {
    const userId = req.user.userId;
    await this.statusService.setOfflineStatus(userId);
  }

  @Get('friends')
  @ApiOperation({ summary: "Get the online status of the user's friends" })
  @ApiOkResponse({ type: [FriendStatusDto] })
  async getFriendsStatus(@Req() req: AuthRequest): Promise<FriendStatusDto[]> {
    const userId = req.user.userId;
    return this.statusService.getFriendsStatus(userId);
  }
}
