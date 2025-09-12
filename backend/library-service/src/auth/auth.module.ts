import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OwnershipGuard } from './guards/ownership.guard';
import { RoleGuard } from './guards/role.guard';
import { LibraryModule } from '../library/library.module';

@Module({
  imports: [LibraryModule], // Import LibraryModule to use LibraryService in OwnershipGuard
  providers: [JwtAuthGuard, OwnershipGuard, RoleGuard],
  exports: [JwtAuthGuard, OwnershipGuard, RoleGuard],
})
export class AuthModule {}
