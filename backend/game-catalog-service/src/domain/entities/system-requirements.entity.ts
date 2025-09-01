import { Column } from 'typeorm';

export class Requirements {
  @Column({ nullable: true })
  os: string;

  @Column({ nullable: true })
  processor: string;

  @Column({ nullable: true })
  memory: string;

  @Column({ nullable: true })
  graphics: string;

  @Column({ nullable: true })
  storage: string;
}

export class SystemRequirements {
  @Column(type => Requirements)
  minimum: Requirements;

  @Column(type => Requirements)
  recommended: Requirements;
}
