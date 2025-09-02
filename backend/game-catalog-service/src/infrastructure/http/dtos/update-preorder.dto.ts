import { IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreatePreorderDto } from './create-preorder.dto';

// For simplicity, we'll allow updating top-level fields.
// Updating tiers would require a more complex DTO and service logic (e.g., specifying tier IDs to update/delete).
export class UpdatePreorderDto extends PartialType(CreatePreorderDto) {}
