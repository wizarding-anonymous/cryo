import {
  Controller,
  Put,
  Body,
  Req,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StatusService } from './status.service';
import { SetStatusDto } from './dto/set-status.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthRequest } from '../common/interfaces/auth-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiTags('Online Status')
@Controller('status')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Put('online')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Set the user's status to online" })
  async setOnlineStatus(@Req() req: AuthRequest, @Body() dto: SetStatusDto) {
    const userId = req.user.userId;
    await this.statusService.setOnlineStatus(userId, dto.currentGame);
  }

  @Put('offline')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Set the user's status to offline" })
  async setOfflineStatus(@Req() req: AuthRequest) {
    const userId = req.user.userId;
    await this.statusService.setOfflineStatus(userId);
  }

  @Get('friends')
  @ApiOperation({ summary: "Get the online status of the user's friends" })
  async getFriendsStatus(@Req() req: AuthRequest) {
    const userId = req.user.userId;
    return this.statusService.getFriendsStatus(userId);
  }
}
