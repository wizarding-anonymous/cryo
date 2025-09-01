import { ApiProperty } from '@nestjs/swagger';
import { IPublisherVerification } from '../../../domain/interfaces/publisher.interface';

export class BasicPublisherProfileDto {
  @ApiProperty({ example: 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2' })
  id: string;

  @ApiProperty({ example: 'd7g8h9i0-j1k2-l3m4-n5o6-p7q8r9s0t1u2' })
  userId: string;

  @ApiProperty({ example: 'MegaPublishing Inc.' })
  companyName: string;

  @ApiProperty({ example: 'aaa_publisher' })
  companyType: string;

  @ApiProperty({
    example: {
      isVerified: true,
      verificationLevel: 'premium',
      status: 'approved',
    },
  })
  verification: IPublisherVerification;
}
