import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LibraryGame } from '../entities/library-game.entity';
import { LibraryQueryDto } from '../dto/request.dto';

@Injectable()
export class LibraryRepository extends Repository<LibraryGame> {
  constructor(
    @InjectRepository(LibraryGame)
    private repository: Repository<LibraryGame>,
  ) {
    super(repository.target, repository.manager, repository.queryRunner);
  }

  async findUserLibrary(
    userId: string,
    queryDto: LibraryQueryDto,
  ): Promise<[LibraryGame[], number]> {
    return this.repository.findAndCount({
      where: { userId },
      skip: (queryDto.page - 1) * queryDto.limit,
      take: queryDto.limit,
      order: { [queryDto.sortBy]: queryDto.sortOrder },
    });
  }

  async findOneByUserIdAndGameId(
    userId: string,
    gameId: string,
  ): Promise<LibraryGame | null> {
    return this.repository.findOne({ where: { userId, gameId } });
  }
}
