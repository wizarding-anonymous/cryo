import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsBoolean,
  IsOptional,
  IsDate,
  IsUUID,
  MaxLength,
  Length,
  IsArray,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SystemRequirements } from '../interfaces/game.interface';

class SystemRequirementsValidator implements SystemRequirements {
  @IsString()
  minimum: string;

  @IsString()
  recommended: string;
}

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  id: string;

  @Column({ length: 255 })
  @Index({ fulltext: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @Column('text', { nullable: true })
  @IsString()
  @IsOptional()
  description: string;

  @Column({ length: 500, nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  shortDescription: string;

  @Column('decimal', { precision: 10, scale: 2 })
  @Index()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price: number;

  @Column({ length: 3, default: 'RUB' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @Column({ length: 100, nullable: true })
  @Index()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  genre: string;

  @Column({ length: 255, nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  developer: string;

  @Column({ length: 255, nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  publisher: string;

  @Column('date', { nullable: true })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  releaseDate: Date;

  @Column('text', { array: true, default: [] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images: string[];

  @Column('jsonb', { nullable: true })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => SystemRequirementsValidator)
  systemRequirements: SystemRequirements;

  @Column({ default: true })
  @Index()
  @IsBoolean()
  available: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
