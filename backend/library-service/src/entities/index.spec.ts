import * as entitiesIndex from './index';
import { LibraryGame } from './library-game.entity';
import { PurchaseHistory } from './purchase-history.entity';

describe('Entities Index', () => {
  it('should export LibraryGame entity', () => {
    expect(entitiesIndex.LibraryGame).toBe(LibraryGame);
  });

  it('should export PurchaseHistory entity', () => {
    expect(entitiesIndex.PurchaseHistory).toBe(PurchaseHistory);
  });

  it('should export all expected entities', () => {
    const exportedKeys = Object.keys(entitiesIndex);
    expect(exportedKeys).toContain('LibraryGame');
    expect(exportedKeys).toContain('PurchaseHistory');
    expect(exportedKeys).toContain('PurchaseStatus');
    expect(exportedKeys).toHaveLength(3);
  });
});
