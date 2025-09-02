import { Controller, Post, UploadedFile, UseInterceptors, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { MediaService, MediaType } from '../../../application/services/media.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateMediaDto } from '../dtos/create-media.dto';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('developer', 'admin')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a media file (screenshot or video) for a game' })
  @ApiResponse({ status: 201, description: 'The media has been successfully uploaded.' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Body() createMediaDto: CreateMediaDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          // We validate file type inside the service to distinguish screenshots from videos
        ],
        exceptionFactory: (error) => {
            throw new BadRequestException(error);
        },
      }),
    ) file: Express.Multer.File,
  ) {
    return this.mediaService.uploadFile(file, createMediaDto.gameId, createMediaDto.mediaType);
  }
}
