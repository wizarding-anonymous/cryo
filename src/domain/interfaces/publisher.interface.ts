import { VerificationStatus } from '../../application/events/types/verification-status.enum';

export interface IPublisherVerification {
  isVerified: boolean;
  verificationLevel: 'basic' | 'premium' | 'enterprise';
  verificationBadges: string[];
  verifiedAt?: Date;
  status: VerificationStatus;
}
