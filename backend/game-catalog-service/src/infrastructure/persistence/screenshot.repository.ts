import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Screenshot } from '../../domain/entities/screenshot.entity';

@Injectable()
export class ScreenshotRepository {
  constructor(
    @InjectRepository(Screenshot)
    private readonly screenshotRepository: Repository<Screenshot>,
  ) {}

  async findById(id: string): Promise<Screenshot | null> {
    return this.screenshotRepository.findOneBy({ id });
  }

  async create(screenshot: Partial<Screenshot>): Promise<Screenshot> {
    const newScreenshot = this.screenshotRepository.create(screenshot);
    return this.screenshotRepository.save(newScreenshot);
  }

  async remove(screenshot: Screenshot): Promise<void> {
    await this.screenshotRepository.remove(screenshot);
  }
}
