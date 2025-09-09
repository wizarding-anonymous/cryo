import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { SeasonPass } from './season-pass.entity';
import { Dlc } from './dlc.entity';

@Entity('season_pass_dlcs')
export class SeasonPassDlc {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SeasonPass, seasonPass => seasonPass.dlcsInPass)
  seasonPass: SeasonPass;

  @ManyToOne(() => Dlc, dlc => dlc.seasonPasses)
  dlc: Dlc;

  @Column()
  seasonPassId: string;

  @Column()
  dlcId: string;
}
