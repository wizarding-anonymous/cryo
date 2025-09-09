import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';
import * as path from 'path';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { ScreenshotRepository } from '../../infrastructure/persistence/screenshot.repository';
import { VideoRepository } from '../../infrastructure/persistence/video.repository';
import { Screenshot } from '../../domain/entities/screenshot.entity';
import { Video } from '../../domain/entities/video.entity';

export enum MediaType {
    SCREENSHOT = 'screenshot',
    VIDEO = 'video',
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly s3Endpoint: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly gameRepository: GameRepository,
    private readonly screenshotRepository: ScreenshotRepository,
    private readonly videoRepository: VideoRepository,
    ) {
    this.s3Endpoint = this.configService.get<string>('s3.endpoint');
    this.bucket = this.configService.get<string>('s3.bucket');
    this.s3Client = new S3Client({
      endpoint: this.s3Endpoint,
      region: this.configService.get<string>('s3.region'),
      credentials: {
        accessKeyId: this.configService.get<string>('s3.accessKeyId'),
        secretAccessKey: this.configService.get<string>('s3.secretAccessKey'),
      },
      forcePathStyle: true, // Needed for MinIO
    });
  }

  async uploadFile(file: Express.Multer.File, gameId: string, mediaType: MediaType): Promise<Screenshot | Video> {
    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found`);
    }

    try {
      const url = await this.uploadToS3(file.buffer, file.mimetype, file.originalname);

      if (mediaType === MediaType.SCREENSHOT) {
        if (!file.mimetype.startsWith('image/')) {
          throw new BadRequestException('Invalid file type for screenshot. Must be an image.');
        }
        const thumbnailBuffer = await sharp(file.buffer).resize(200, 200, { fit: 'inside' }).toBuffer();
        const thumbnailUrl = await this.uploadToS3(thumbnailBuffer, file.mimetype, file.originalname, 'thumb');

        const screenshot = new Screenshot();
        screenshot.url = url;
        screenshot.thumbnailUrl = thumbnailUrl;
        screenshot.game = game;
        return this.screenshotRepository.create(screenshot);

      } else if (mediaType === MediaType.VIDEO) {
        if (!file.mimetype.startsWith('video/')) {
          throw new BadRequestException('Invalid file type for video. Must be a video file.');
        }
        const video = new Video();
        video.url = url;
        // video.duration = await this.getVideoDuration(file.buffer); // Placeholder for a more complex implementation
        video.game = game;
        return this.videoRepository.create(video);
      } else {
        throw new BadRequestException('Invalid media type specified.');
      }

    } catch (error) {
        this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
        throw new Error('Failed to upload file.');
    }
  }

  private async uploadToS3(buffer: Buffer, mimetype: string, originalName: string, suffix?: string): Promise<string> {
    const name = path.parse(originalName).name.replace(/[^a-zA-Z0-9]/g, '');
    const ext = path.parse(originalName).ext;
    const finalSuffix = suffix ? `-${suffix}` : '';
    const key = `media/${uuidv4()}-${name}${finalSuffix}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ACL: 'public-read',
    });

    await this.s3Client.send(command);
    // This URL construction is specific to MinIO/local S3 setups.
    // For AWS S3, you'd typically use `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`
    return `${this.s3Endpoint}/${this.bucket}/${key}`;
  }
}
