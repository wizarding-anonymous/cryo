import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ProxyRequestDto } from '../dto/proxy-request.dto';

@Injectable()
export class ProxyValidationPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    // Only validate body parameters for proxy requests
    if (metadata.type !== 'body') {
      return value;
    }

    // Skip validation if no value provided
    if (!value) {
      return value;
    }

    // Transform plain object to class instance
    const object = plainToClass(ProxyRequestDto, value);

    // Validate the object
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const errorMessages = errors.map((error) => {
        const constraints = error.constraints;
        return constraints && Object.keys(constraints).length > 0
          ? Object.values(constraints).join(', ')
          : 'Validation failed';
      });

      throw new BadRequestException({
        error: 'PROXY_VALIDATION_ERROR',
        message: 'Proxy request validation failed',
        statusCode: 400,
        details: errorMessages,
      });
    }

    return object;
  }
}
