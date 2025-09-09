import { Module } from '@nestjs/common';
import { MockGameKeysService } from './services/mock.game-keys.service';
import { IGameKeysService } from './interfaces/game-keys.service.interface';

@Module({
  providers: [
    {
      provide: 'IGameKeysService',
      useClass: MockGameKeysService,
    },
  ],
  exports: ['IGameKeysService'],
})
export class GameKeysModule {}
