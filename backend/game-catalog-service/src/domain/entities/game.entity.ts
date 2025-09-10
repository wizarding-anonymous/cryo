import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany, ManyToMany, JoinTable, OneToOne } from 'typeorm';
import { Category } from './category.entity';
import { Screenshot } from './screenshot.entity';
import { Tag } from './tag.entity';
import { Video } from './video.entity';
import { Discount } from './discount.entity';
import { SystemRequirements } from './system-requirements.entity';
import { GameTranslation } from './game-translation.entity';
import { Dlc } from './dlc.entity';
import { Demo } from './demo.entity';
import { GameEdition } from './game-edition.entity';
import { GameLifecycleStatusEntity } from './game-lifecycle-status.entity';
import { GameRoadmap } from './game-roadmap.entity';
import { Promotion } from './promotion.entity';

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
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  title: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  shortDescription: string;

  @Column({ type: 'uuid' })
  developerId: string;

  @Column({ type: 'uuid', nullable: true })
  publisherId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'boolean', default: false })
  isFree: boolean;

  @Column({ type: 'date', nullable: true })
  releaseDate: Date;

  @Column({
    type: 'enum',
    enum: GameStatus,
    default: GameStatus.DRAFT,
  })
  @Index()
  status: GameStatus;

  @Column(type => SystemRequirements, { prefix: false })
  systemRequirements: SystemRequirements;

  @OneToOne(() => Demo, demo => demo.game, { cascade: true, nullable: true })
  demo: Demo;

  @OneToOne(() => GameLifecycleStatusEntity, status => status.game, { cascade: true, nullable: true })
  lifecycleStatus: GameLifecycleStatusEntity;

  @OneToMany(() => GameRoadmap, roadmap => roadmap.game, { cascade: true })
  roadmaps: GameRoadmap[];

  @OneToMany(() => Screenshot, screenshot => screenshot.game, { cascade: true })
  screenshots: Screenshot[];

  @OneToMany(() => Video, video => video.game, { cascade: true })
  videos: Video[];

  @OneToMany(() => Discount, discount => discount.game, { cascade: true })
  discounts: Discount[];

  @OneToMany(() => GameTranslation, translation => translation.game, { cascade: true })
  translations: GameTranslation[];

  @OneToMany(() => Dlc, dlc => dlc.baseGame, { cascade: true })
  dlcs: Dlc[];

  @OneToMany(() => GameEdition, edition => edition.game, { cascade: true })
  editions: GameEdition[];

  @ManyToMany(() => Category, { cascade: true })
  @JoinTable({
    name: 'game_categories',
    joinColumn: { name: 'game_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories: Category[];

  @ManyToMany(() => Tag, { cascade: true })
  @JoinTable({
    name: 'game_tags',
    joinColumn: { name: 'game_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @ManyToMany(() => Promotion, promotion => promotion.games)
  promotions: Promotion[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
