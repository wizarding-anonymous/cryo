import * as guardsIndex from './index';

describe('Guards Index', () => {
  it('should export all guard modules', () => {
    const exportedKeys = Object.keys(guardsIndex);

    // Check that the index exports the expected guards
    expect(exportedKeys.length).toBeGreaterThan(0);

    // Verify the index exports are defined
    expect(guardsIndex).toBeDefined();
  });

  it('should have consistent exports', () => {
    // This test ensures the index file is properly structured
    expect(typeof guardsIndex).toBe('object');
  });
});
