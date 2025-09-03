import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Dlc } from './dlc.entity';
import { GameEdition } from './game-edition.entity';

@Entity('dlc_edition_compatibilities')
export class DlcEditionCompatibility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Dlc, dlc => dlc.compatibleEditions)
  dlc: Dlc;

  @ManyToOne(() => GameEdition, edition => edition.compatibleDlcs)
  edition: GameEdition;

  @Column()
  dlcId: string;

  @Column()
  editionId: string;
}
