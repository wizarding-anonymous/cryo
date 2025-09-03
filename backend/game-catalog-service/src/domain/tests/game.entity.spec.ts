import { validate } from 'class-validator';
import { Game, GameStatus } from '../entities/game.entity';

describe('Game Entity Validation', () => {
  it('should pass validation with a valid game object', async () => {
    const game = new Game();
    game.id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    game.title = 'Test Game';
    game.slug = 'test-game';
    game.developerId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
    game.price = 19.99;
    game.isFree = false;
    game.status = GameStatus.DRAFT;
    game.createdAt = new Date();
    game.updatedAt = new Date();

    const errors = await validate(game);
    expect(errors.length).toBe(0);
  });

  it('should fail validation if title is too short', async () => {
    const game = new Game();
    game.id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    game.title = 'T'; // Too short
    game.slug = 'test-game';
    game.developerId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
    game.price = 19.99;
    game.isFree = false;
    game.status = GameStatus.DRAFT;

    const errors = await validate(game);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('should fail validation if price is negative', async () => {
    const game = new Game();
    game.id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    game.title = 'Test Game';
    game.slug = 'test-game';
    game.developerId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
    game.price = -5.00; // Negative price
    game.isFree = false;
    game.status = GameStatus.DRAFT;

    const errors = await validate(game);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('should fail validation if developerId is not a UUID', async () => {
    const game = new Game();
    game.id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    game.title = 'Test Game';
    game.slug = 'test-game';
    game.developerId = 'not-a-uuid'; // Invalid UUID
    game.price = 19.99;
    game.isFree = false;
    game.status = GameStatus.DRAFT;

    const errors = await validate(game);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isUuid');
  });
});
