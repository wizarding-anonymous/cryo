import { ApiProperty } from '@nestjs/swagger';
import { LibraryGame } from '../entities/library-game.entity';

export class GameDetailsDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  developer: string;

  @ApiProperty()
  publisher: string;

  @ApiProperty({ type: [String] })
  images: string[];

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty()
  releaseDate: Date;
}

export class LibraryGameDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  gameId: string;

  @ApiProperty()
  purchaseDate: Date;

  @ApiProperty()
  purchasePrice: number;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ format: 'uuid' })
  orderId: string;

  @ApiProperty({ type: GameDetailsDto, required: false })
  gameDetails?: GameDetailsDto;

  static fromEntity(entity: LibraryGame, gameDetails?: GameDetailsDto): LibraryGameDto {
    const dto = new LibraryGameDto();
    dto.id = entity.id;
    dto.gameId = entity.gameId;
    dto.purchaseDate = entity.purchaseDate;
    dto.purchasePrice = entity.purchasePrice;
    dto.currency = entity.currency;
    dto.orderId = entity.orderId;
    if (gameDetails) {
      dto.gameDetails = gameDetails;
    }
    return dto;
  }
}

class PaginationDto {
    @ApiProperty()
    total: number;

    @ApiProperty()
    page: number;

    @ApiProperty()
    limit: number;

    @ApiProperty()
    totalPages: number;
}

export class LibraryResponseDto {
  @ApiProperty({ type: [LibraryGameDto] })
  games: LibraryGameDto[];

  @ApiProperty({ type: PaginationDto })
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class OwnershipResponseDto {
  @ApiProperty()
  owns: boolean;

  @ApiProperty({ required: false })
  purchaseDate?: Date;

  @ApiProperty({ required: false })
  purchasePrice?: number;

  @ApiProperty({ required: false })
  currency?: string;
}
