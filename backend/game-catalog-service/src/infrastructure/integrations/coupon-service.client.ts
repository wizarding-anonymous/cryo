import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface CouponInfo {
  id: string;
  code: string;
  discountPercentage: number;
  discountAmount?: number;
  description: string;
  expiresAt: Date;
}

export interface CouponValidation {
  isValid: boolean;
  discountPercentage?: number;
  discountAmount?: number;
  errorMessage?: string;
}

@Injectable()
export class CouponServiceClient {
  private readonly logger = new Logger(CouponServiceClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('COUPON_SERVICE_URL', 'http://coupon-service:3000');
  }

  async getApplicableCoupons(gameId: string, userId?: string): Promise<CouponInfo[]> {
    try {
      const params = userId ? { userId } : {};
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/coupons/game/${gameId}`, { params })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get applicable coupons for game ${gameId}:`, error.message);
      return [];
    }
  }

  async validateCoupon(couponCode: string, gameId: string): Promise<CouponValidation> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/coupons/validate`, {
          couponCode,
          gameId,
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to validate coupon ${couponCode} for game ${gameId}:`, error.message);
      return {
        isValid: false,
        errorMessage: 'Coupon service unavailable',
      };
    }
  }
}