import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDate,
  IsEnum,
  MinLength,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany, ManyToMany, JoinTable, OneToOne } from 'typeorm';
import { Category } from './category.entity';
import { Screenshot } from './screenshot.entity';
import { Tag } from './tag.entity';
import { Video } from './video.entity';
import { Discount } from './discount.entity';
import { SystemRequirements } from './system-requirements.entity';
import { GameTranslation } from './game-translation.entity';
import { Dlc } from './dlc.entity';
import { Preorder } from './preorder.entity';
import { Demo } from './demo.entity';
import { GameEdition } from './game-edition.entity';
import { FranchiseGame } from './franchise-game.entity';

export enum GameStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  @IsString()
  @MaxLength(255)
  slug: string;

  @Column({ type: 'text', nullable: true })
  @IsString()
  @IsOptional()
  description: string;

  @Column({ type: 'text', nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  shortDescription: string;

  @Column({ type: 'uuid' })
  @IsUUID()
  developerId: string;

  @Column({ type: 'uuid', nullable: true })
  @IsUUID()
  @IsOptional()
  publisherId: string;

  @Column({ name: 'developer_name', type: 'varchar', length: 255, nullable: true })
  @IsString()
  @IsOptional()
  developerName: string;

  @Column({ name: 'publisher_name', type: 'varchar', length: 255, nullable: true })
  @IsString()
  @IsOptional()
  publisherName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @Column({ type: 'boolean', default: false })
  @IsBoolean()
  isFree: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  @IsNumber()
  @Min(0)
  averageRating: number;

  @Column({ type: 'int', default: 0 })
  @IsNumber()
  @Min(0)
  reviewsCount: number;

  @Column({ type: 'date', nullable: true })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  releaseDate: Date;

  @Column({
    type: 'enum',
    enum: GameStatus,
    default: GameStatus.DRAFT,
  })
  @Index()
  @IsEnum(GameStatus)
  status: GameStatus;

  @Column(type => SystemRequirements, { prefix: false })
  @ValidateNested()
  @Type(() => SystemRequirements)
  systemRequirements: SystemRequirements;

  @OneToOne(() => Preorder, preorder => preorder.game, { cascade: true, nullable: true })
  @ValidateNested()
  @IsOptional()
  @Type(() => Preorder)
  preorder: Preorder;

  @OneToOne(() => Demo, demo => demo.game, { cascade: true, nullable: true })
  @ValidateNested()
  @IsOptional()
  @Type(() => Demo)
  demo: Demo;

  @OneToMany(() => Screenshot, screenshot => screenshot.game, { cascade: true })
  @ValidateNested({ each: true })
  @Type(() => Screenshot)
  screenshots: Screenshot[];

  @OneToMany(() => Video, video => video.game, { cascade: true })
  @ValidateNested({ each: true })
  @Type(() => Video)
  videos: Video[];

  @OneToMany(() => Discount, discount => discount.game, { cascade: true })
  @ValidateNested({ each: true })
  @Type(() => Discount)
  discounts: Discount[];

  @OneToMany(() => GameTranslation, translation => translation.game, { cascade: true })
  @ValidateNested({ each: true })
  @Type(() => GameTranslation)
  translations: GameTranslation[];

  @OneToMany(() => Dlc, dlc => dlc.baseGame, { cascade: true })
  @ValidateNested({ each: true })
  @Type(() => Dlc)
  dlcs: Dlc[];

  @OneToMany(() => GameEdition, edition => edition.game, { cascade: true })
  @ValidateNested({ each: true })
  @Type(() => GameEdition)
  editions: GameEdition[];

  @ManyToMany(() => Category, { cascade: true })
  @JoinTable({
    name: 'game_categories',
    joinColumn: { name: 'game_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  @ValidateNested({ each: true })
  @Type(() => Category)
  categories: Category[];

  @ManyToMany(() => Tag, { cascade: true })
  @JoinTable({
    name: 'game_tags',
    joinColumn: { name: 'game_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  @ValidateNested({ each: true })
  @Type(() => Tag)
  tags: Tag[];

  @OneToMany(() => FranchiseGame, franchiseGame => franchiseGame.game)
  franchises: FranchiseGame[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @IsDate()
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  @IsDate()
  updatedAt: Date;
}
