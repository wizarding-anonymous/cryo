import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class AlsService {
  private readonly als = new AsyncLocalStorage<{ correlationId: string }>();

  get<T extends keyof { correlationId: string }>(key: T) {
    return this.als.getStore()?.[key];
  }

  run<T>(correlationId: string, callback: () => T): T {
    return this.als.run({ correlationId }, callback);
  }
}
