import { Controller, Delete, Get, Post, Put, Req, Res, UseGuards, UseInterceptors, UsePipes, Body } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { OptionalAuthGuard } from '../security/guards/optional-auth.guard';
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard';
import { RateLimitGuard } from '../security/guards/rate-limit.guard';
import { LoggingInterceptor } from '../shared/interceptors/logging.interceptor';
import { ResponseInterceptor } from '../shared/interceptors/response.interceptor';
import { CacheInterceptor } from '../shared/interceptors/cache.interceptor';
import { CorsInterceptor } from '../shared/interceptors/cors.interceptor';
import { JsonBodyValidationPipe } from '../common/pipes/json-body-validation.pipe';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('api')
@UseGuards(RateLimitGuard)
@UseInterceptors(CorsInterceptor, ResponseInterceptor, LoggingInterceptor, CacheInterceptor)
@ApiTags('Proxy')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('v1/users/*')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Proxy GET requests to user service' })
  async handleUserGet(@Req() req: Request, @Res() res: Response): Promise<any> {
    return this.handle('v1/users/*', req, res);
  }

  @Get('v1/games/*')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Proxy GET requests to game catalog service' })
  async handleGameGet(@Req() req: Request, @Res() res: Response): Promise<any> {
    return this.handle('v1/games/*', req, res);
  }

  @Get('v1/library/*')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Proxy GET requests to library service' })
  async handleLibraryGet(@Req() req: Request, @Res() res: Response): Promise<any> {
    return this.handle('v1/library/*', req, res);
  }

  @Post('v1/*')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new JsonBodyValidationPipe())
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Proxy POST requests (auth required)' })
  async handlePost(@Req() req: Request, @Res() res: Response, @Body() _body: any): Promise<any> {
    return this.handle('v1/*', req, res);
  }

  @Put('v1/*')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new JsonBodyValidationPipe())
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Proxy PUT requests (auth required)' })
  async handlePut(@Req() req: Request, @Res() res: Response, @Body() _body: any): Promise<any> {
    return this.handle('v1/*', req, res);
  }

  @Delete('v1/*')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Proxy DELETE requests (auth required)' })
  async handleDelete(@Req() req: Request, @Res() res: Response): Promise<any> {
    return this.handle('v1/*', req, res);
  }

  private async handle(_path: string, req: Request, res: Response): Promise<any> {
    const result = await this.proxyService.forward(req);
    res.status(result.statusCode);
    Object.entries(result.headers).forEach(([k, v]) => res.header(k, v));
    return res.send(result.body);
  }
}
