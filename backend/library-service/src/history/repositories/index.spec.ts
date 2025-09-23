import * as repositoriesIndex from './index';
import { PurchaseHistoryRepository } from './purchase-history.repository';

describe('History Repositories Index', () => {
  it('should export PurchaseHistoryRepository', () => {
    expect(repositoriesIndex.PurchaseHistoryRepository).toBe(PurchaseHistoryRepository);
  });

  it('should export all expected repositories', () => {
    const exportedKeys = Object.keys(repositoriesIndex);
    expect(exportedKeys).toContain('PurchaseHistoryRepository');
    expect(exportedKeys).toHaveLength(1);
  });
});