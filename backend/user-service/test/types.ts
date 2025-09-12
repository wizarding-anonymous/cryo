// Test types to fix ESLint issues
export interface TestResponse {
  body: {
    data?: {
      user?: {
        email: string;
        name: string;
      };
      accessToken?: string;
      email?: string;
      name?: string;
    };
    error?: {
      code: string;
    };
    status?: string;
  };
  status: number;
}

export interface TestApp {
  getHttpServer(): unknown;
}
