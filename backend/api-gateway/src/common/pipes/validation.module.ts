import { Module } from '@nestjs/common';
import { GlobalValidationPipe } from './global-validation.pipe';
import { JsonBodyValidationPipe } from './json-body-validation.pipe';
import { ProxyValidationPipe } from './proxy-validation.pipe';

@Module({
  providers: [GlobalValidationPipe, JsonBodyValidationPipe, ProxyValidationPipe],
  exports: [GlobalValidationPipe, JsonBodyValidationPipe, ProxyValidationPipe],
})
export class ValidationModule {}