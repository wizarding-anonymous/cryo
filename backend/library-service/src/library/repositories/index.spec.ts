import * as repositoriesIndex from './index';
import { LibraryRepository } from './library.repository';

describe('Library Repositories Index', () => {
  it('should export LibraryRepository', () => {
    expect(repositoriesIndex.LibraryRepository).toBe(LibraryRepository);
  });

  it('should export all expected repositories', () => {
    const exportedKeys = Object.keys(repositoriesIndex);
    expect(exportedKeys).toContain('LibraryRepository');
    expect(exportedKeys).toHaveLength(1);
  });
});