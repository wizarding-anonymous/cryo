import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Supported image formats
const ALLOWED_FILE_TYPES = /\.(jpg|jpeg|png|gif)$/i;

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

// Upload directory
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const multerConfig: MulterOptions = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      // Generate unique filename: userId-timestamp.ext
      const userId = req.params?.userId || 'unknown';
      const timestamp = Date.now();
      const ext = extname(file.originalname);
      const filename = `${userId}-${timestamp}${ext}`;
      cb(null, filename);
    },
  }),
  fileFilter: (req, file, cb) => {
    // Check file type
    if (!ALLOWED_FILE_TYPES.test(file.originalname)) {
      return cb(
        new BadRequestException(
          'Неподдерживаемый формат файла. Разрешены только: jpg, jpeg, png, gif',
        ),
        false,
      );
    }

    // Check MIME type for additional security
    if (!file.mimetype.startsWith('image/')) {
      return cb(
        new BadRequestException('Файл должен быть изображением'),
        false,
      );
    }

    cb(null, true);
  },
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only one file at a time
  },
};

export const avatarUploadConfig = {
  ...multerConfig,
  dest: UPLOAD_DIR,
};
