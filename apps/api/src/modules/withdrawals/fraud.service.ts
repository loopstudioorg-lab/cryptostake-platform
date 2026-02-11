import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface FraudIndicator {
  type: 'NEW_ADDRESS' | 'HIGH_AMOUNT' | 'VELOCITY' | 'SUSPICIOUS_PATTERN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  score: number;
}

@Injectable()
export class FraudService {
  private readonly newAddressCooldownHours: number;
  private readonly dailyWithdrawalLimitUsd: number;
  private readonly largeWithdrawalThresholdUsd: number;
  private readonly maxDailyWithdrawalRequests: number;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.newAddressCooldownHours = this.configService.get('security.newAddressCooldownHours') || 24;
    this.dailyWithdrawalLimitUsd = this.configService.get('security.dailyWithdrawalLimitUsd') || 10000;
    this.largeWithdrawalThresholdUsd = this.configService.get('security.largeWithdrawalThresholdUsd') || 5000;
    this.maxDailyWithdrawalRequests = this.configService.get('security.maxDailyWithdrawalRequests') || 5;
  }

  async analyzeWithdrawalRequest(params: {
    userId: string;
    destinationAddress: string;
    amount: Decimal;
    assetId: string;
    chainId: string;
  }): Promise<{ indicators: FraudIndicator[]; totalScore: number }> {
    const indicators: FraudIndicator[] = [];

    // Check 1: New withdrawal address
    const addressCheck = await this.checkNewAddress(
      params.userId,
      params.destinationAddress,
      params.chainId,
    );
    if (addressCheck) {
      indicators.push(addressCheck);
    }

    // Check 2: Large withdrawal amount
    const amountCheck = await this.checkLargeAmount(
      params.amount,
      params.assetId,
    );
    if (amountCheck) {
      indicators.push(amountCheck);
    }

    // Check 3: Velocity - too many requests in 24h
    const velocityCheck = await this.checkVelocity(params.userId);
    if (velocityCheck) {
      indicators.push(velocityCheck);
    }

    // Check 4: Daily limit exceeded
    const limitCheck = await this.checkDailyLimit(
      params.userId,
      params.amount,
      params.assetId,
    );
    if (limitCheck) {
      indicators.push(limitCheck);
    }

    // Check 5: Pattern analysis
    const patternCheck = await this.checkPatterns(params.userId);
    if (patternCheck) {
      indicators.push(patternCheck);
    }

    const totalScore = indicators.reduce((sum, ind) => sum + ind.score, 0);

    return { indicators, totalScore };
  }

  private async checkNewAddress(
    userId: string,
    address: string,
    chainId: string,
  ): Promise<FraudIndicator | null> {
    // Check if address is in whitelist
    const whitelisted = await this.prisma.addressWhitelist.findUnique({
      where: {
        userId_chainId_address: {
          userId,
          chainId,
          address: address.toLowerCase(),
        },
      },
    });

    if (!whitelisted) {
      return {
        type: 'NEW_ADDRESS',
        severity: 'MEDIUM',
        description: 'First-time withdrawal to this address',
        score: 30,
      };
    }

    // Check if still in cooldown
    if (whitelisted.cooldownEndsAt > new Date()) {
      return {
        type: 'NEW_ADDRESS',
        severity: 'HIGH',
        description: `Address in cooldown until ${whitelisted.cooldownEndsAt.toISOString()}`,
        score: 50,
      };
    }

    return null;
  }

  private async checkLargeAmount(
    amount: Decimal,
    assetId: string,
  ): Promise<FraudIndicator | null> {
    // Get asset price
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) return null;

    const usdValue = amount.mul(asset.priceUsd);

    if (usdValue.greaterThan(this.largeWithdrawalThresholdUsd)) {
      const severity = usdValue.greaterThan(this.dailyWithdrawalLimitUsd) ? 'HIGH' : 'MEDIUM';
      return {
        type: 'HIGH_AMOUNT',
        severity,
        description: `Large withdrawal: $${usdValue.toFixed(2)} USD`,
        score: severity === 'HIGH' ? 40 : 20,
      };
    }

    return null;
  }

  private async checkVelocity(userId: string): Promise<FraudIndicator | null> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentRequests = await this.prisma.withdrawalRequest.count({
      where: {
        userId,
        createdAt: { gte: oneDayAgo },
      },
    });

    if (recentRequests >= this.maxDailyWithdrawalRequests) {
      return {
        type: 'VELOCITY',
        severity: 'HIGH',
        description: `${recentRequests} withdrawal requests in last 24h (limit: ${this.maxDailyWithdrawalRequests})`,
        score: 40,
      };
    }

    if (recentRequests >= this.maxDailyWithdrawalRequests * 0.7) {
      return {
        type: 'VELOCITY',
        severity: 'MEDIUM',
        description: `${recentRequests} withdrawal requests in last 24h`,
        score: 20,
      };
    }

    return null;
  }

  private async checkDailyLimit(
    userId: string,
    newAmount: Decimal,
    assetId: string,
  ): Promise<FraudIndicator | null> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get asset price
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) return null;

    // Get user's daily limit
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dailyWithdrawalLimit: true },
    });

    if (!user) return null;

    // Calculate total withdrawn in 24h
    const recentWithdrawals = await this.prisma.withdrawalRequest.findMany({
      where: {
        userId,
        createdAt: { gte: oneDayAgo },
        status: { notIn: ['REJECTED', 'FAILED'] },
      },
      include: { asset: true },
    });

    let totalUsd = new Decimal(0);
    for (const w of recentWithdrawals) {
      totalUsd = totalUsd.add(w.amount.mul(w.asset.priceUsd));
    }

    // Add new amount
    const newTotalUsd = totalUsd.add(newAmount.mul(asset.priceUsd));

    if (newTotalUsd.greaterThan(user.dailyWithdrawalLimit)) {
      return {
        type: 'HIGH_AMOUNT',
        severity: 'HIGH',
        description: `Exceeds daily limit: $${newTotalUsd.toFixed(2)} / $${user.dailyWithdrawalLimit.toFixed(2)}`,
        score: 50,
      };
    }

    return null;
  }

  private async checkPatterns(userId: string): Promise<FraudIndicator | null> {
    // Check for suspicious patterns
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        emailVerified: true,
        kycStatus: true,
      },
    });

    if (!user) return null;

    // New account (less than 7 days old)
    const accountAgeMs = Date.now() - user.createdAt.getTime();
    const accountAgeDays = accountAgeMs / (24 * 60 * 60 * 1000);

    if (accountAgeDays < 7) {
      return {
        type: 'SUSPICIOUS_PATTERN',
        severity: 'MEDIUM',
        description: `New account (${Math.floor(accountAgeDays)} days old)`,
        score: 25,
      };
    }

    // Unverified email
    if (!user.emailVerified) {
      return {
        type: 'SUSPICIOUS_PATTERN',
        severity: 'LOW',
        description: 'Email not verified',
        score: 15,
      };
    }

    return null;
  }

  async addToWhitelist(
    userId: string,
    chainId: string,
    address: string,
    label?: string,
  ) {
    const cooldownEndsAt = new Date(
      Date.now() + this.newAddressCooldownHours * 60 * 60 * 1000,
    );

    return this.prisma.addressWhitelist.upsert({
      where: {
        userId_chainId_address: {
          userId,
          chainId,
          address: address.toLowerCase(),
        },
      },
      create: {
        userId,
        chainId,
        address: address.toLowerCase(),
        label,
        cooldownEndsAt,
      },
      update: {
        label,
        // Don't reset cooldown on update
      },
    });
  }
}
