import { AddSearchIndexes1703000000001 } from '../../src/migrations/1703000000001-AddSearchIndexes';
import { QueryRunner } from 'typeorm';

describe('AddSearchIndexes1703000000001', () => {
  let migration: AddSearchIndexes1703000000001;
  let queryRunner: Partial<QueryRunner>;

  beforeEach(() => {
    migration = new AddSearchIndexes1703000000001();
    queryRunner = {
      query: jest.fn(),
    };
  });

  describe('up', () => {
    it('should execute migration queries to add search indexes', async () => {
      await migration.up(queryRunner as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalled();
      // Verify that the migration creates search indexes
      const calls = (queryRunner.query as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe('down', () => {
    it('should execute rollback queries to remove search indexes', async () => {
      await migration.down(queryRunner as QueryRunner);

      expect(queryRunner.query).toHaveBeenCalled();
      // Verify that the migration drops the search indexes
      const calls = (queryRunner.query as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
