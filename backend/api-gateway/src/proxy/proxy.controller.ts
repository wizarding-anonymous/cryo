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
import { OptionalAuthGuard, JwtAuthGuard, RateLimitGuard } from '../security/guards';
import { 
  LoggingInterceptor, 
  ResponseInterceptor, 
  CacheInterceptor, 
  CorsInterceptor 
} from '../shared/interceptors';
import { JsonBodyValidationPipe } from '../common/pipes';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('api')
@UseGuards(RateLimitGuard)
@UseInterceptors(CorsInterceptor, LoggingInterceptor, ResponseInterceptor, CacheInterceptor)
@ApiTags('Proxy')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('*')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Proxy GET requests to microservices' })
  async handleGetRequest(@Req() request: Request, @Res() response: Response): Promise<any> {
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Proxy POST requests (authentication required)' })
  async handlePostRequest(@Req() request: Request, @Res() response: Response): Promise<any> {
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Proxy PUT requests (authentication required)' })
  async handlePutRequest(@Req() request: Request, @Res() response: Response): Promise<any> {
    const result = await this.proxyService.forward(request);
    response.status(result.statusCode);
    Object.entries(result.headers).forEach(([key, value]) => {
      response.header(key, value);
    });
    return response.send(result.body);
  }

  @Delete('*')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Proxy DELETE requests (authentication required)' })
  async handleDeleteRequest(@Req() request: Request, @Res() response: Response): Promise<any> {
    const result = await this.proxyService.forward(request);
    response.status(result.statusCode);
    Object.entries(result.headers).forEach(([key, value]) => {
      response.header(key, value);
    });
    return response.send(result.body);
  }
}
