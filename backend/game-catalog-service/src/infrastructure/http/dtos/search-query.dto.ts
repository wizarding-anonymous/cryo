import { IsOptional, IsString, IsNumber, Min, IsArray, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export enum SortOrder {
    ASC = 'asc',
    DESC = 'desc',
}

export class SearchQueryDto {
    @IsString()
    q: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Transform(({ value }) => value.split(','))
    tags?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Transform(({ value }) => value.split(','))
    categories?: string[];

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => parseFloat(value))
    minPrice?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => parseFloat(value))
    maxPrice?: number;

    @IsOptional()
    @IsString()
    @IsIn(['price', 'releaseDate', 'rating'])
    sortBy?: string = 'releaseDate';

    @IsOptional()
    @IsIn(['asc', 'desc'])
    sortOrder?: SortOrder = SortOrder.DESC;
}
