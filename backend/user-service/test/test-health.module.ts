import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { TestHealthController } from './test-health.controller';

@Module({
    imports: [
        TerminusModule,
        HttpModule,
    ],
    controllers: [TestHealthController],
})
export class TestHealthModule { }