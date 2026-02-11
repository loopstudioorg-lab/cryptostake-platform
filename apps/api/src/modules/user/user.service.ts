import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceService } from '../ledger/balance.service';
import { StakesService } from '../stakes/stakes.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
    private stakesService: StakesService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        timezone: true,
        emailVerified: true,
        twoFactorEnabled: true,
        kycStatus: true,
        notificationsEnabled: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    params: {
      displayName?: string;
      timezone?: string;
      notificationsEnabled?: boolean;
    },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: params,
      select: {
        id: true,
        email: true,
        displayName: true,
        timezone: true,
        notificationsEnabled: true,
      },
    });
  }

  async getDashboard(userId: string) {
    const [
      balances,
      stakingSummary,
      recentDeposits,
      recentWithdrawals,
      pendingWithdrawals,
    ] = await Promise.all([
      this.balanceService.getAllBalances(userId),
      this.stakesService.getStakingSummary(userId),
      this.prisma.deposit.findMany({
        where: { userId },
        include: { asset: true, chain: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.withdrawalRequest.findMany({
        where: { userId },
        include: { asset: true, chain: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: {
          userId,
          status: { in: ['PENDING_REVIEW', 'APPROVED', 'PROCESSING', 'SENT', 'CONFIRMING'] },
        },
        _sum: { amount: true },
      }),
    ]);

    // Calculate totals
    let totalDeposited = new Decimal(0);
    let totalAvailable = new Decimal(0);

    for (const balance of balances) {
      totalAvailable = totalAvailable.add(balance.available);
      // Could calculate totalDeposited from deposits if needed
    }

    return {
      totalDeposited: totalDeposited.toString(),
      availableBalance: totalAvailable.toString(),
      stakedBalance: stakingSummary.totalStaked,
      accruedRewards: stakingSummary.totalRewardsAccrued,
      pendingWithdrawals: (pendingWithdrawals._sum.amount || new Decimal(0)).toString(),
      balancesByAsset: balances,
      activeStakes: stakingSummary.activeStakes,
      recentDeposits,
      recentWithdrawals,
    };
  }

  async getBalances(userId: string) {
    return this.balanceService.getAllBalances(userId);
  }

  async getNotifications(userId: string, options?: { unreadOnly?: boolean; limit?: number }) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(options?.unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
    });
  }

  async markNotificationRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllNotificationsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }
}
