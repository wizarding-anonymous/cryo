export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  executionTime: number;
}
