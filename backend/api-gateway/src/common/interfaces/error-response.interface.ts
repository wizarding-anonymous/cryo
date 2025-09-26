export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  service?: string;
  requestId?: string;
  details?: any;
}
