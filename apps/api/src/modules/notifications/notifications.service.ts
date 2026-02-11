import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type NotificationType =
  | 'deposit_pending'
  | 'deposit_confirmed'
  | 'withdrawal_pending'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'withdrawal_completed'
  | 'stake_created'
  | 'stake_completed'
  | 'rewards_claimed'
  | 'security_alert'
  | 'system_announcement';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(params: CreateNotificationParams) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data || {},
      },
    });
  }

  async notifyDepositConfirmed(
    userId: string,
    deposit: { amount: string; assetSymbol: string; txHash: string },
  ) {
    return this.create({
      userId,
      type: 'deposit_confirmed',
      title: 'Deposit Confirmed',
      message: `Your deposit of ${deposit.amount} ${deposit.assetSymbol} has been confirmed.`,
      data: { txHash: deposit.txHash },
    });
  }

  async notifyWithdrawalApproved(
    userId: string,
    withdrawal: { amount: string; assetSymbol: string; requestId: string },
  ) {
    return this.create({
      userId,
      type: 'withdrawal_approved',
      title: 'Withdrawal Approved',
      message: `Your withdrawal request for ${withdrawal.amount} ${withdrawal.assetSymbol} has been approved and is being processed.`,
      data: { withdrawalRequestId: withdrawal.requestId },
    });
  }

  async notifyWithdrawalRejected(
    userId: string,
    withdrawal: { amount: string; assetSymbol: string; requestId: string; reason?: string },
  ) {
    return this.create({
      userId,
      type: 'withdrawal_rejected',
      title: 'Withdrawal Rejected',
      message: `Your withdrawal request for ${withdrawal.amount} ${withdrawal.assetSymbol} has been rejected.${
        withdrawal.reason ? ` Reason: ${withdrawal.reason}` : ''
      }`,
      data: { withdrawalRequestId: withdrawal.requestId },
    });
  }

  async notifyWithdrawalCompleted(
    userId: string,
    withdrawal: { amount: string; assetSymbol: string; txHash: string; requestId: string },
  ) {
    return this.create({
      userId,
      type: 'withdrawal_completed',
      title: 'Withdrawal Completed',
      message: `Your withdrawal of ${withdrawal.amount} ${withdrawal.assetSymbol} has been completed.`,
      data: { txHash: withdrawal.txHash, withdrawalRequestId: withdrawal.requestId },
    });
  }

  async notifyStakeCreated(
    userId: string,
    stake: { amount: string; assetSymbol: string; poolName: string; stakeId: string },
  ) {
    return this.create({
      userId,
      type: 'stake_created',
      title: 'Stake Created',
      message: `You have staked ${stake.amount} ${stake.assetSymbol} in ${stake.poolName}.`,
      data: { stakePositionId: stake.stakeId },
    });
  }

  async notifyRewardsClaimed(
    userId: string,
    rewards: { amount: string; assetSymbol: string; stakeId: string },
  ) {
    return this.create({
      userId,
      type: 'rewards_claimed',
      title: 'Rewards Claimed',
      message: `You have claimed ${rewards.amount} ${rewards.assetSymbol} in staking rewards.`,
      data: { stakePositionId: rewards.stakeId },
    });
  }

  async notifySecurityAlert(
    userId: string,
    alert: { title: string; message: string; data?: Record<string, any> },
  ) {
    return this.create({
      userId,
      type: 'security_alert',
      title: alert.title,
      message: alert.message,
      data: alert.data,
    });
  }

  // Bulk notification for system announcements
  async broadcastAnnouncement(announcement: { title: string; message: string }) {
    const users = await this.prisma.user.findMany({
      where: { 
        isActive: true,
        notificationsEnabled: true,
      },
      select: { id: true },
    });

    const notifications = users.map(user => ({
      userId: user.id,
      type: 'system_announcement' as const,
      title: announcement.title,
      message: announcement.message,
      data: {},
    }));

    return this.prisma.notification.createMany({
      data: notifications,
    });
  }
}
