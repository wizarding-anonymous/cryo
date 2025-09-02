import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from '../../domain/entities/video.entity';

@Injectable()
export class VideoRepository {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
  ) {}

  async findById(id: string): Promise<Video | null> {
    return this.videoRepository.findOneBy({ id });
  }

  async create(video: Partial<Video>): Promise<Video> {
    const newVideo = this.videoRepository.create(video);
    return this.videoRepository.save(newVideo);
  }

  async remove(video: Video): Promise<void> {
    await this.videoRepository.remove(video);
  }
}
