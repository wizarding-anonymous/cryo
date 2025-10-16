import {
  ApiResponseDto,
  PaginatedResponseDto,
  PaginationMeta,
} from './api-response.dto';

describe('ApiResponseDto', () => {
  describe('success', () => {
    it('should create a successful response', () => {
      const data = { id: '1', name: 'Test User' };
      const response = ApiResponseDto.success(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.error).toBeNull();
      expect(response.timestamp).toBeDefined();
      expect(response.correlationId).toBeDefined();
    });

    it('should create a successful response with meta and correlationId', () => {
      const data = { id: '1', name: 'Test User' };
      const meta = { version: '1.0' };
      const correlationId = 'test-correlation-id';
      const response = ApiResponseDto.success(data, meta, correlationId);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.error).toBeNull();
      expect(response.meta).toEqual(meta);
      expect(response.correlationId).toBe(correlationId);
    });
  });

  describe('error', () => {
    it('should create an error response', () => {
      const errorMessage = 'Something went wrong';
      const response = ApiResponseDto.error(errorMessage);

      expect(response.success).toBe(false);
      expect(response.data).toBeNull();
      expect(response.error).toBe(errorMessage);
      expect(response.timestamp).toBeDefined();
      expect(response.correlationId).toBeDefined();
    });

    it('should create an error response with correlationId and data', () => {
      const errorMessage = 'Validation failed';
      const correlationId = 'test-correlation-id';
      const data = { field: 'email' };
      const response = ApiResponseDto.error(errorMessage, correlationId, data);

      expect(response.success).toBe(false);
      expect(response.data).toEqual(data);
      expect(response.error).toBe(errorMessage);
      expect(response.correlationId).toBe(correlationId);
    });
  });
});

describe('PaginatedResponseDto', () => {
  it('should create a paginated response', () => {
    const items = [
      { id: '1', name: 'User 1' },
      { id: '2', name: 'User 2' },
    ];
    const pagination = new PaginationMeta(100, 1, 20, true, false);
    const response = new PaginatedResponseDto(items, pagination);

    expect(response.items).toEqual(items);
    expect(response.pagination).toEqual(pagination);
  });
});

describe('PaginationMeta', () => {
  it('should create pagination metadata', () => {
    const meta = new PaginationMeta(100, 1, 20, true, false);

    expect(meta.total).toBe(100);
    expect(meta.page).toBe(1);
    expect(meta.limit).toBe(20);
    expect(meta.totalPages).toBe(5);
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrevious).toBe(false);
    expect(meta.nextCursor).toBeNull();
    expect(meta.previousCursor).toBeNull();
  });

  it('should create pagination metadata with cursors', () => {
    const nextCursor = 'next-cursor';
    const previousCursor = 'prev-cursor';
    const meta = new PaginationMeta(
      100,
      2,
      20,
      true,
      true,
      nextCursor,
      previousCursor,
    );

    expect(meta.total).toBe(100);
    expect(meta.page).toBe(2);
    expect(meta.limit).toBe(20);
    expect(meta.totalPages).toBe(5);
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrevious).toBe(true);
    expect(meta.nextCursor).toBe(nextCursor);
    expect(meta.previousCursor).toBe(previousCursor);
  });

  it('should calculate total pages correctly', () => {
    const meta1 = new PaginationMeta(100, 1, 20);
    expect(meta1.totalPages).toBe(5);

    const meta2 = new PaginationMeta(99, 1, 20);
    expect(meta2.totalPages).toBe(5);

    const meta3 = new PaginationMeta(101, 1, 20);
    expect(meta3.totalPages).toBe(6);

    const meta4 = new PaginationMeta(0, 1, 20);
    expect(meta4.totalPages).toBe(0);
  });
});
