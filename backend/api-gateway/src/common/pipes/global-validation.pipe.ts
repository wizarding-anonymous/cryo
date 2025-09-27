import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import {
  ValidationErrorDto,
  ValidationErrorDetailDto,
} from '../dto/validation-error.dto';

@Injectable()
export class GlobalValidationPipe
  extends NestValidationPipe
  implements PipeTransform
{
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
      exceptionFactory: (errors: ValidationError[]) => {
        const details: ValidationErrorDetailDto[] =
          this.transformValidationErrors(errors);

        const validationError: ValidationErrorDto = {
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          statusCode: 400,
          details,
        };

        return new BadRequestException(validationError);
      },
    });
  }

  private transformValidationErrors(
    errors: ValidationError[],
    parentPath = '',
  ): ValidationErrorDetailDto[] {
    const details: ValidationErrorDetailDto[] = [];

    for (const error of errors) {
      const fieldPath = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

      if (error.constraints) {
        for (const [constraint, message] of Object.entries(error.constraints)) {
          details.push({
            field: fieldPath,
            message,
            value: error.value,
            constraint,
          });
        }
      }

      if (error.children && error.children.length > 0) {
        details.push(
          ...this.transformValidationErrors(error.children, fieldPath),
        );
      }
    }

    return details;
  }

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    // Skip validation for certain metadata types
    if (metadata.type === 'custom' || metadata.type === 'param') {
      return value;
    }

    return super.transform(value, metadata);
  }
}
