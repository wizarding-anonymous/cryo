import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseQueryDto } from '../../common/dto';

export class LibraryQueryDto extends BaseQueryDto {
  // Inherits pagination and sorting from BaseQueryDto
  // Additional library-specific query parameters can be added here in the future
}
