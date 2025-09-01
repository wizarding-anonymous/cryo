import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @Column({ length: 100 })
  action: string;

  @Column({ name: 'resource_type', length: 50, nullable: true })
  resourceType?: string;

  @Column({ name: 'resource_id', nullable: true })
  resourceId?: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: any;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
