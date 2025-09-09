import { Column } from 'typeorm';
import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class Requirements {
  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  os: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  processor: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  memory: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  graphics: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  storage: string;
}

export class SystemRequirements {
  @Column(type => Requirements)
  @ValidateNested()
  @Type(() => Requirements)
  minimum: Requirements;

  @Column(type => Requirements)
  @ValidateNested()
  @Type(() => Requirements)
  recommended: Requirements;
}
