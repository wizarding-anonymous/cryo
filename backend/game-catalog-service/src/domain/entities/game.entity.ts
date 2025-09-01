import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { Category } from './category.entity';
import { Screenshot } from './screenshot.entity';
import { Tag } from './tag.entity';
import { Video } from './video.entity';

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

  @OneToMany(() => Screenshot, screenshot => screenshot.game, { cascade: true })
  screenshots: Screenshot[];

  @OneToMany(() => Video, video => video.game, { cascade: true })
  videos: Video[];

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

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
