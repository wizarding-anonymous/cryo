import { Injectable, Logger, BadRequestException } from '@nestjs/common';

// We need to define this type as NestJS uses it for file uploads
// In a real app this might come from a library like `@types/multer`
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        originalname: string;
        mimetype: string;
        size: number;
      }
    }
  }
}

@Injectable()
export class MockAvatarService {
  private readonly logger = new Logger(MockAvatarService.name);

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<string> {
    this.logger.log(`📸 Uploading avatar for user ${userId}`);
    this.logger.log(`📁 File: ${file.originalname}, size: ${file.size} bytes`);

    this.validateAvatarFile(file);
    const processedUrl = await this.processAvatar(file);

    this.logger.log(`✅ Avatar processed and saved: ${processedUrl}`);
    return processedUrl;
  }

  private validateAvatarFile(file: Express.Multer.File): void {
    if (!file) {
        throw new BadRequestException('No file uploaded.');
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type');
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      throw new BadRequestException('File too large');
    }
  }

  private async processAvatar(file: Express.Multer.File): Promise<string> {
    this.logger.log(`🔄 Processing image: resizing to 256x256 and converting to WebP`);
    const mockUrl = `https://cdn.gaming-platform.ru/avatars/${Date.now()}_processed.webp`;
    return mockUrl;
  }

  async deleteAvatar(userId: string, avatarUrl: string): Promise<void> {
    this.logger.log(`🗑️ Deleting avatar for user ${userId}: ${avatarUrl}`);
  }
}
