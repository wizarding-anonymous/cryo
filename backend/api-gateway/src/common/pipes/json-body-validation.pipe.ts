import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class JsonBodyValidationPipe implements PipeTransform {
  transform(value: any) {
    // Allow empty body for some methods if upstream expects; but for POST/PUT we expect an object or array
    if (value === undefined || value === null) {
      throw new BadRequestException({
        error: 'INVALID_BODY',
        message: 'Request body is required',
        statusCode: 400,
      });
    }
    const t = typeof value;
    if (t === 'object') return value;
    throw new BadRequestException({
      error: 'INVALID_BODY',
      message: 'Request body must be a JSON object or array',
      statusCode: 400,
    });
  }
}

