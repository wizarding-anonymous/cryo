// Test interfaces for proper TypeScript typing in tests

export interface TestGameResponse {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  price: number;
  currency: string;
  genre: string;
  developer: string;
  publisher: string;
  releaseDate: string;
  images: string[];
  systemRequirements: {
    minimum: string;
    recommended: string;
  };
  available: boolean;
  createdAt: string;
}

export interface TestGameListResponse {
  games: TestGameResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface TestPurchaseInfoResponse {
  id: string;
  title: string;
  price: number;
  currency: string;
  available: boolean;
}

export interface TestErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    path: string;
    details?: Array<{
      field: string;
      message: string;
      value: unknown;
    }>;
  };
}

export interface TestHealthResponse {
  status: string;
  info: Record<string, unknown>;
  error: Record<string, unknown>;
  details: Record<string, unknown>;
}

export interface TestCreateGameDto {
  title: string;
  description: string;
  shortDescription: string;
  price: number;
  currency: string;
  genre: string;
  developer: string;
  publisher: string;
  releaseDate: string;
  images: string[];
  systemRequirements: {
    minimum: string;
    recommended: string;
  };
  available: boolean;
}

// Utility type for SuperTest response
export interface TestResponse<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

// Type guards for runtime type checking
export function isGameResponse(obj: unknown): obj is TestGameResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'title' in obj &&
    'price' in obj &&
    'available' in obj
  );
}

export function isGameListResponse(obj: unknown): obj is TestGameListResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'games' in obj &&
    'total' in obj &&
    'page' in obj &&
    'limit' in obj
  );
}

export function isErrorResponse(obj: unknown): obj is TestErrorResponse {
  // Handle both custom error format and NestJS default format
  if (typeof obj === 'object' && obj !== null) {
    // Custom format with nested error object
    if (
      'error' in obj &&
      typeof (obj as TestErrorResponse).error === 'object'
    ) {
      return true;
    }
    // NestJS default format - convert it to expected format
    if ('message' in obj && 'statusCode' in obj) {
      const nestError = obj as any;
      // Transform NestJS format to expected format
      (obj as any).error = {
        code: 'VALIDATION_ERROR',
        message: Array.isArray(nestError.message)
          ? nestError.message.join(', ')
          : nestError.message,
        statusCode: nestError.statusCode,
        timestamp: new Date().toISOString(),
        path: '',
        details: Array.isArray(nestError.message)
          ? nestError.message.map((msg: string) => ({
              field: 'unknown',
              message: msg,
              value: null,
            }))
          : [],
      };
      return true;
    }
  }
  return false;
}

export function isPurchaseInfoResponse(
  obj: unknown,
): obj is TestPurchaseInfoResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'title' in obj &&
    'price' in obj &&
    'currency' in obj &&
    'available' in obj
  );
}

export function isHealthResponse(obj: unknown): obj is TestHealthResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'status' in obj &&
    'details' in obj
  );
}
