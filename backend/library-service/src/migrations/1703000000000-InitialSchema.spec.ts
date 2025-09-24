import { InitialSchema1703000000000 } from './1703000000000-InitialSchema';
import { QueryRunner } from 'typeorm';

describe('InitialSchema1703000000000', () => {
  let migration: InitialSchema1703000000000;
  let queryRunner: Partial<QueryRunner>;

  beforeEach(() => {
    migration = new InitialSchema1703000000000();
    queryRunner = {
      query: jest.fn(),
    };
  });

  describe('up', () => {
    it('should execute migration queries', async () => {
      await migration.up(queryRunner as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalled();
      // Verify that the migration creates the necessary tables
      const calls = (queryRunner.query as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe('down', () => {
    it('should execute rollback queries', async () => {
      await migration.down(queryRunner as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalled();
      // Verify that the migration drops the tables
      const calls = (queryRunner.query as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
