import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';

export const TRANSFORM_RESPONSE_METADATA = 'transform_response';
export const EXCLUDE_TRANSFORM_METADATA = 'exclude_transform';

interface TransformResponseOptions {
  includeMetadata?: boolean;
  excludeFields?: string[];
  addTimestamp?: boolean;
}

interface RequestWithMetadata extends Request {
  requestId?: string;
  cacheHit?: boolean;
}

/**
 * Decorator to enable response transformation for specific endpoints
 * @param options Transformation options
 */
export const TransformResponse = (options?: TransformResponseOptions) => {
  return (
    target: object,
    _propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ) => {
    if (descriptor) {
      Reflect.defineMetadata(
        TRANSFORM_RESPONSE_METADATA,
        options || {},
        descriptor.value as object,
      );
      return descriptor;
    }
    Reflect.defineMetadata(TRANSFORM_RESPONSE_METADATA, options || {}, target);
    return target;
  };
};

/**
 * Decorator to exclude specific endpoints from response transformation
 */
export const ExcludeTransform = () => {
  return (
    target: object,
    _propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ) => {
    if (descriptor) {
      Reflect.defineMetadata(
        EXCLUDE_TRANSFORM_METADATA,
        true,
        descriptor.value as object,
      );
      return descriptor;
    }
    Reflect.defineMetadata(EXCLUDE_TRANSFORM_METADATA, true, target);
    return target;
  };
};

interface TransformedResponse<T = unknown> {
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
    cached?: boolean;
    responseTime?: number;
    version?: string;
  };
}

@Injectable()
export class ResponseTransformationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseTransformationInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const request = context.switchToHttp().getRequest<RequestWithMetadata>();
    const response = context.switchToHttp().getResponse<Response>();

    // Check if transformation should be excluded
    const excludeTransform = this.reflector.get<boolean>(
      EXCLUDE_TRANSFORM_METADATA,
      handler,
    );

    if (excludeTransform) {
      return next.handle();
    }

    // Get transformation options
    const transformOptions = this.reflector.get<TransformResponseOptions>(
      TRANSFORM_RESPONSE_METADATA,
      handler,
    );

    const startTime = Date.now();
    const requestId = request.requestId;

    return next.handle().pipe(
      map((data: unknown) => {
        const responseTime = Date.now() - startTime;

        // Skip transformation for health checks and non-JSON responses
        if (this.shouldSkipTransformation(request, response, data)) {
          return data;
        }

        // Apply field exclusions if specified
        let transformedData: unknown = data;
        if (
          transformOptions?.excludeFields?.length &&
          transformOptions.excludeFields.length > 0
        ) {
          transformedData = this.excludeFields(
            data,
            transformOptions.excludeFields,
          );
        }

        // Create base response structure
        const transformedResponse: TransformedResponse = {
          data: transformedData,
        };

        // Add metadata if requested or if it's a default behavior
        if (transformOptions?.includeMetadata !== false) {
          transformedResponse.meta = {
            timestamp: new Date().toISOString(),
            ...(requestId && { requestId }),
            ...(request.cacheHit && { cached: true }),
            responseTime,
            version: 'v1',
          };
        }

        // Add custom timestamp if requested
        if (transformOptions?.addTimestamp && !transformedResponse.meta) {
          transformedResponse.meta = {
            timestamp: new Date().toISOString(),
          };
        }

        this.logger.debug(
          `Response transformed for ${request.method} ${request.url} (${responseTime}ms)`,
        );

        return transformedResponse;
      }),
    );
  }

  private shouldSkipTransformation(
    request: RequestWithMetadata,
    response: Response,
    data: unknown,
  ): boolean {
    // Skip for health check endpoints
    if (request.url?.includes('/health')) {
      return true;
    }

    // Skip if response is not JSON
    const contentType = response.getHeader('content-type');
    if (contentType && !String(contentType).includes('application/json')) {
      return true;
    }

    // Skip if data is null or undefined
    if (data === null || data === undefined) {
      return true;
    }

    // Skip if data is already in transformed format
    if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
      return true;
    }

    return false;
  }

  private excludeFields(obj: unknown, fieldsToExclude: string[]): unknown {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.excludeFields(item, fieldsToExclude));
    }

    const result = { ...(obj as Record<string, unknown>) };
    fieldsToExclude.forEach((field) => {
      if (field.includes('.')) {
        // Handle nested field exclusion (e.g., 'user.password')
        const [parentField, ...nestedPath] = field.split('.');
        if (result[parentField]) {
          result[parentField] = this.excludeFields(result[parentField], [
            nestedPath.join('.'),
          ]);
        }
      } else {
        delete result[field];
      }
    });

    return result;
  }
}
