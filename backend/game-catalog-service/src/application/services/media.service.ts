import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';
import * as path from 'path';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly s3Endpoint: string;

  constructor(private readonly configService: ConfigService) {
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

  private async uploadToS3(buffer: Buffer, mimetype: string, originalName: string, suffix?: string): Promise<string> {
    const name = path.parse(originalName).name;
    const ext = path.parse(originalName).ext;
    const finalSuffix = suffix ? `-${suffix}` : '';
    const key = `${uuidv4()}-${name}${finalSuffix}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ACL: 'public-read',
    });

    await this.s3Client.send(command);
    return `${this.s3Endpoint}/${this.bucket}/${key}`;
  }

  async uploadFile(file: Express.Multer.File): Promise<{ url: string; thumbnailUrl?: string }> {
    try {
        const url = await this.uploadToS3(file.buffer, file.mimetype, file.originalname);
        let thumbnailUrl: string | undefined = undefined;

        // If it's an image, create and upload a thumbnail
        if (file.mimetype.startsWith('image/')) {
          const thumbnailBuffer = await sharp(file.buffer)
            .resize(200, 200, { fit: 'inside' })
            .toBuffer();

          thumbnailUrl = await this.uploadToS3(thumbnailBuffer, file.mimetype, file.originalname, 'thumb');
        }

        return { url, thumbnailUrl };

    } catch (error) {
        this.logger.error(`Failed to upload file to S3: ${error.message}`, error.stack);
        throw new Error('Failed to upload file.');
    }
  }
}
