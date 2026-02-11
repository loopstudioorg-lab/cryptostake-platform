import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BalanceService } from '../ledger/balance.service';
import { Decimal } from '@prisma/client/runtime/library';
import { ethers } from 'ethers';

@Injectable()
export class DepositsService {
  private hdWallet: ethers.HDNodeWallet | null = null;

  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
  ) {
    // Initialize HD wallet from mnemonic if available
    const mnemonic = process.env.DEPOSIT_WALLET_MNEMONIC;
    if (mnemonic) {
      this.hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic);
    }
  }

  async getOrCreateDepositAddress(userId: string, chainId: string) {
    // Check for existing address
    const existing = await this.prisma.depositAddress.findUnique({
      where: {
        userId_chainId: {
          userId,
          chainId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Get chain info
    const chain = await this.prisma.chain.findUnique({
      where: { id: chainId },
    });

    if (!chain) {
      throw new NotFoundException('Chain not found');
    }

    // Generate new deposit address
    let address: string;
    let derivationPath: string | null = null;
    let derivationIndex: number | null = null;

    if (this.hdWallet) {
      // HD derivation - BIP44: m/44'/60'/0'/0/index
      // Get next index
      const lastAddress = await this.prisma.depositAddress.findFirst({
        where: { chainId },
        orderBy: { derivationIndex: 'desc' },
      });

      derivationIndex = (lastAddress?.derivationIndex ?? -1) + 1;
      derivationPath = `m/44'/60'/0'/0/${derivationIndex}`;
      
      const childWallet = this.hdWallet.derivePath(derivationPath);
      address = childWallet.address;
    } else {
      // Fallback: Generate random address (for demo only)
      const wallet = ethers.Wallet.createRandom();
      address = wallet.address;
    }

    return this.prisma.depositAddress.create({
      data: {
        userId,
        chainId,
        address,
        derivationPath,
        derivationIndex,
      },
    });
  }

  async getUserDeposits(userId: string, options?: { chainId?: string; status?: string }) {
    return this.prisma.deposit.findMany({
      where: {
        userId,
        ...(options?.chainId && { chainId: options.chainId }),
        ...(options?.status && { status: options.status as any }),
      },
      include: {
        asset: true,
        chain: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDepositById(id: string) {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id },
      include: {
        asset: true,
        chain: true,
        depositAddress: true,
      },
    });

    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    return deposit;
  }

  async recordDeposit(params: {
    txHash: string;
    logIndex: number | null;
    chainId: string;
    depositAddressId: string;
    assetId: string;
    fromAddress: string;
    amount: string;
  }) {
    // Check for duplicate
    const existing = await this.prisma.deposit.findUnique({
      where: {
        txHash_logIndex_chainId: {
          txHash: params.txHash,
          logIndex: params.logIndex ?? 0,
          chainId: params.chainId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Deposit already recorded');
    }

    // Get deposit address to find user
    const depositAddress = await this.prisma.depositAddress.findUnique({
      where: { id: params.depositAddressId },
    });

    if (!depositAddress) {
      throw new NotFoundException('Deposit address not found');
    }

    return this.prisma.deposit.create({
      data: {
        userId: depositAddress.userId,
        assetId: params.assetId,
        chainId: params.chainId,
        depositAddressId: params.depositAddressId,
        txHash: params.txHash,
        logIndex: params.logIndex,
        fromAddress: params.fromAddress,
        amount: new Decimal(params.amount),
        status: 'CONFIRMING',
      },
    });
  }

  async updateConfirmations(depositId: string, confirmations: number) {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id: depositId },
      include: {
        chain: true,
        asset: true,
      },
    });

    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    if (deposit.status === 'CONFIRMED') {
      return deposit; // Already confirmed
    }

    const isConfirmed = confirmations >= deposit.chain.confirmationsRequired;

    if (isConfirmed) {
      // Confirm deposit and credit balance in transaction
      return this.prisma.executeInTransaction(async (tx) => {
        const updatedDeposit = await tx.deposit.update({
          where: { id: depositId },
          data: {
            confirmations,
            status: 'CONFIRMED',
            confirmedAt: new Date(),
          },
        });

        // Credit user balance
        await this.balanceService.creditBalance(tx, {
          userId: deposit.userId,
          assetId: deposit.assetId,
          chainId: deposit.chainId,
          amount: deposit.amount,
          entryType: 'DEPOSIT_CONFIRMED',
          referenceType: 'Deposit',
          referenceId: depositId,
          metadata: {
            txHash: deposit.txHash,
            fromAddress: deposit.fromAddress,
            confirmations,
          },
        });

        return updatedDeposit;
      });
    }

    // Just update confirmations
    return this.prisma.deposit.update({
      where: { id: depositId },
      data: { confirmations },
    });
  }

  async getDepositAddresses(userId: string) {
    return this.prisma.depositAddress.findMany({
      where: { userId },
      include: {
        chain: true,
      },
    });
  }

  async getDepositSummary(userId: string) {
    const deposits = await this.prisma.deposit.groupBy({
      by: ['assetId', 'chainId', 'status'],
      where: { userId },
      _sum: { amount: true },
      _count: true,
    });

    const confirmedTotal = await this.prisma.deposit.aggregate({
      where: { userId, status: 'CONFIRMED' },
      _sum: { amount: true },
      _count: true,
    });

    const pendingTotal = await this.prisma.deposit.aggregate({
      where: { userId, status: 'CONFIRMING' },
      _sum: { amount: true },
      _count: true,
    });

    return {
      totalConfirmed: (confirmedTotal._sum.amount || new Decimal(0)).toString(),
      confirmedCount: confirmedTotal._count,
      totalPending: (pendingTotal._sum.amount || new Decimal(0)).toString(),
      pendingCount: pendingTotal._count,
      byAsset: deposits,
    };
  }
}
