import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('library_games')
@Index(['userId', 'gameId'], { unique: true })
export class LibraryGame {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  @Column('uuid')
  @Index()
  gameId: string;

  @Column('timestamp')
  purchaseDate: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  purchasePrice: number;

  @Column('varchar', { length: 3 })
  currency: string;

  @Column('uuid')
  orderId: string;

  @Column('uuid', { nullable: true })
  purchaseId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
