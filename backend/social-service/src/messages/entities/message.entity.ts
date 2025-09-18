import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  fromUserId: string;

  @Column('uuid')
  @Index()
  toUserId: string;

  @Column('text')
  content: string;

  @Column('boolean', { default: false })
  isRead: boolean;

  @Column('timestamp', { nullable: true })
  readAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
