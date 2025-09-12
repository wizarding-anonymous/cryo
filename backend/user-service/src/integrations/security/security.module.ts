import { Module } from '@nestjs/common';
import { SecurityClient } from './security.client';

@Module({
  providers: [SecurityClient],
  exports: [SecurityClient],
})
export class SecurityModule {}
