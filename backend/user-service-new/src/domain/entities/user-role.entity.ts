import { Entity, Column, CreateDateColumn, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';

@Entity('user_roles')
export class UserRole {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => User, user => user.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt: Date;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy?: string;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt?: Date;
}
