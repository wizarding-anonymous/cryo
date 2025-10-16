import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { UserModule } from '../user/user.module';
import { CacheModule } from '../common/cache/cache.module';
import { multerConfig } from '../common/config/multer.config';

@Module({
  imports: [
    forwardRef(() => UserModule),
    CacheModule,
    MulterModule.register(multerConfig),
    ThrottlerModule.forRoot([
      {
        name: 'avatar-upload',
        ttl: 60000, // 1 minute
        limit: 5, // 5 uploads per minute
      },
      {
        name: 'profile-update',
        ttl: 60000, // 1 minute
        limit: 10, // 10 updates per minute
      },
    ]),
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
