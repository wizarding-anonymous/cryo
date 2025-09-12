import { Game } from '../entities/game.entity';

// This DTO is used to control the shape of the game data sent in API responses.
// It can be used with class-transformer to exclude or transform properties.
// For now, it mirrors the main properties of the Game entity.
export class GameResponseDto {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  price: number;
  currency: string;
  genre: string;
  developer: string;
  publisher: string;
  releaseDate: Date;
  images: string[];
  systemRequirements: Record<string, any>;
  available: boolean;
  createdAt: Date;

  constructor(game: Game) {
    this.id = game.id;
    this.title = game.title;
    this.description = game.description;
    this.shortDescription = game.shortDescription;
    this.price = game.price;
    this.currency = game.currency;
    this.genre = game.genre;
    this.developer = game.developer;
    this.publisher = game.publisher;
    this.releaseDate = game.releaseDate;
    this.images = game.images;
    this.systemRequirements = game.systemRequirements;
    this.available = game.available;
    this.createdAt = game.createdAt;
  }
}
