import { ApiProperty } from '@nestjs/swagger';

export class BasicDeveloperProfileDto {
  @ApiProperty({ example: 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1' })
  id: string;

  @ApiProperty({ example: 'c6f7e3d8-9a0a-4b3e-8c3f-3e3e3e3e3e3e' })
  userId: string;

  @ApiProperty({ example: 'Test Corp' })
  companyName: string;

  @ApiProperty({ example: 'llc' })
  companyType: string;

  @ApiProperty({ example: 'test@corp.com' })
  contactEmail: string;

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiProperty({ example: 'approved' })
  verificationStatus: string;
}
