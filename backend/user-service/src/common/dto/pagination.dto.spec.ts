import { CursorUtils, CursorData } from './pagination.dto';

describe('CursorUtils', () => {
  describe('encodeCursor', () => {
    it('should encode cursor data to base64', () => {
      const cursorData: CursorData = {
        id: '123',
        createdAt: '2023-12-01T10:00:00Z',
      };

      const encoded = CursorUtils.encodeCursor(cursorData);
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');

      // Should be valid base64
      expect(() => Buffer.from(encoded, 'base64')).not.toThrow();
    });

    it('should encode cursor data with additional fields', () => {
      const cursorData: CursorData = {
        id: '123',
        createdAt: '2023-12-01T10:00:00Z',
        name: 'John Doe',
        email: 'john@example.com',
      };

      const encoded = CursorUtils.encodeCursor(cursorData);
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');
    });
  });

  describe('decodeCursor', () => {
    it('should decode valid cursor', () => {
      const originalData: CursorData = {
        id: '123',
        createdAt: '2023-12-01T10:00:00Z',
      };

      const encoded = CursorUtils.encodeCursor(originalData);
      const decoded = CursorUtils.decodeCursor(encoded);

      expect(decoded).toEqual(originalData);
    });

    it('should decode cursor with additional fields', () => {
      const originalData: CursorData = {
        id: '123',
        createdAt: '2023-12-01T10:00:00Z',
        name: 'John Doe',
        email: 'john@example.com',
      };

      const encoded = CursorUtils.encodeCursor(originalData);
      const decoded = CursorUtils.decodeCursor(encoded);

      expect(decoded).toEqual(originalData);
    });

    it('should return null for invalid cursor', () => {
      const invalidCursor = 'invalid-cursor';
      const decoded = CursorUtils.decodeCursor(invalidCursor);

      expect(decoded).toBeNull();
    });

    it('should return null for malformed base64', () => {
      const malformedCursor = 'not-base64!@#$';
      const decoded = CursorUtils.decodeCursor(malformedCursor);

      expect(decoded).toBeNull();
    });

    it('should return null for valid base64 but invalid JSON', () => {
      const invalidJson = Buffer.from('invalid json').toString('base64');
      const decoded = CursorUtils.decodeCursor(invalidJson);

      expect(decoded).toBeNull();
    });
  });

  describe('createUserCursor', () => {
    it('should create cursor from user object with default sortBy', () => {
      const user = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date('2023-12-01T10:00:00Z'),
        updatedAt: new Date('2023-12-01T11:00:00Z'),
      };

      const cursor = CursorUtils.createUserCursor(user);
      const decoded = CursorUtils.decodeCursor(cursor);

      expect(decoded).toEqual({
        id: '123',
        createdAt: '2023-12-01T10:00:00.000Z',
      });
    });

    it('should create cursor from user object with custom sortBy', () => {
      const user = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date('2023-12-01T10:00:00Z'),
        updatedAt: new Date('2023-12-01T11:00:00Z'),
      };

      const cursor = CursorUtils.createUserCursor(user, 'updatedAt');
      const decoded = CursorUtils.decodeCursor(cursor);

      expect(decoded).toEqual({
        id: '123',
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T11:00:00.000Z',
      });
    });

    it('should create cursor from user object with string sortBy field', () => {
      const user = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date('2023-12-01T10:00:00Z'),
      };

      const cursor = CursorUtils.createUserCursor(user, 'name');
      const decoded = CursorUtils.decodeCursor(cursor);

      expect(decoded).toEqual({
        id: '123',
        createdAt: '2023-12-01T10:00:00.000Z',
        name: 'John Doe',
      });
    });

    it('should handle missing sortBy field gracefully', () => {
      const user = {
        id: '123',
        name: 'John Doe',
        createdAt: new Date('2023-12-01T10:00:00Z'),
      };

      const cursor = CursorUtils.createUserCursor(user, 'nonExistentField');
      const decoded = CursorUtils.decodeCursor(cursor);

      expect(decoded).toEqual({
        id: '123',
        createdAt: '2023-12-01T10:00:00.000Z',
      });
    });
  });

  describe('round-trip encoding/decoding', () => {
    it('should maintain data integrity through encode/decode cycle', () => {
      const testCases: CursorData[] = [
        {
          id: '123',
          createdAt: '2023-12-01T10:00:00Z',
        },
        {
          id: '456',
          createdAt: '2023-12-01T10:00:00Z',
          name: 'Jane Doe',
          email: 'jane@example.com',
        },
        {
          id: '789',
          createdAt: '2023-12-01T10:00:00Z',
          customField: 'custom value',
          numericField: 42,
          booleanField: true,
        },
      ];

      testCases.forEach((originalData) => {
        const encoded = CursorUtils.encodeCursor(originalData);
        const decoded = CursorUtils.decodeCursor(encoded);
        expect(decoded).toEqual(originalData);
      });
    });
  });
});
