import { Game, GameListResponse } from './game.interface';
import { GetGamesDto } from '../dto/get-games.dto';
import { CreateGameDto } from '../dto/create-game.dto';
import { UpdateGameDto } from '../dto/update-game.dto';

export interface IGameService {
  /**
   * Retrieves a paginated list of games.
   * @param getGamesDto - DTO containing pagination parameters.
   */
  getAllGames(getGamesDto: GetGamesDto): Promise<GameListResponse>;

  /**
   * Retrieves a single game by its unique ID.
   * @param id - The UUID of the game.
   */
  getGameById(id: string): Promise<Game | null>;

  /**
   * Retrieves detailed information for a single game by its ID.
   * @param id - The UUID of the game.
   */
  getGameDetails(id: string): Promise<Game | null>;

  /**
   * Creates a new game.
   * @param createGameDto - DTO containing the new game's data.
   */
  createGame(createGameDto: CreateGameDto): Promise<Game>;

  /**
   * Updates an existing game.
   * @param id - The UUID of the game to update.
   * @param updateGameDto - DTO containing the fields to update.
   */
  updateGame(id: string, updateGameDto: UpdateGameDto): Promise<Game>;

  /**
   * Deletes a game.
   * @param id - The UUID of the game to delete.
   */
  deleteGame(id: string): Promise<void>;
}
