import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    // Services for user-related business logic will be added here later.
  ],
  controllers: [
    // Controllers for user-related API endpoints will be added here later.
  ],
  exports: [TypeOrmModule], // Export TypeOrmModule to make UserRepository available to other modules.
})
export class UserModule {}
