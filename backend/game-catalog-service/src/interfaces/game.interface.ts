export interface SystemRequirements {
  minimum: string;
  recommended: string;
}

export interface Game {
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
  systemRequirements: SystemRequirements;
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameListResponse {
  games: Game[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}
