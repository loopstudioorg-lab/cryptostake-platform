import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from './encryption.service';

@Injectable()
export class TwoFactorService {
  private readonly APP_NAME = 'CryptoStake';

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {
    // Configure authenticator
    authenticator.options = {
      digits: 6,
      step: 30,
      window: 1,
    };
  }

  async generateSecret(userId: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorEnabled: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    // Generate new secret
    const secret = authenticator.generateSecret();

    // Create OTP auth URL
    const otpauthUrl = authenticator.keyuri(user.email, this.APP_NAME, secret);

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Store encrypted secret (unverified)
    const encryptedSecret = this.encryptionService.encrypt(secret);

    await this.prisma.twoFactorSecret.upsert({
      where: { userId },
      create: {
        userId,
        encryptedSecret,
        isVerified: false,
      },
      update: {
        encryptedSecret,
        isVerified: false,
      },
    });

    return { secret, qrCodeUrl };
  }

  async verifyAndEnable(userId: string, token: string): Promise<string[]> {
    const twoFactorSecret = await this.prisma.twoFactorSecret.findUnique({
      where: { userId },
    });

    if (!twoFactorSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    if (twoFactorSecret.isVerified) {
      throw new BadRequestException('2FA is already verified');
    }

    // Decrypt and verify
    const secret = this.encryptionService.decrypt(twoFactorSecret.encryptedSecret);
    const isValid = authenticator.verify({ token, secret });

    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    // Generate recovery codes
    const recoveryCodes = this.generateRecoveryCodes();
    const recoveryCodeHashes = recoveryCodes.map(code => 
      this.encryptionService.hash(code)
    );

    // Update user and 2FA secret in transaction
    await this.prisma.$transaction([
      this.prisma.twoFactorSecret.update({
        where: { userId },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true },
      }),
      // Delete old recovery codes
      this.prisma.recoveryCode.deleteMany({
        where: { userId },
      }),
      // Create new recovery codes
      this.prisma.recoveryCode.createMany({
        data: recoveryCodeHashes.map(codeHash => ({
          userId,
          codeHash,
        })),
      }),
    ]);

    return recoveryCodes;
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const twoFactorSecret = await this.prisma.twoFactorSecret.findUnique({
      where: { userId },
    });

    if (!twoFactorSecret || !twoFactorSecret.isVerified) {
      return false;
    }

    const secret = this.encryptionService.decrypt(twoFactorSecret.encryptedSecret);
    return authenticator.verify({ token, secret });
  }

  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const codeHash = this.encryptionService.hash(code);
    
    const recoveryCode = await this.prisma.recoveryCode.findFirst({
      where: {
        userId,
        codeHash,
        isUsed: false,
      },
    });

    if (!recoveryCode) {
      return false;
    }

    // Mark code as used
    await this.prisma.recoveryCode.update({
      where: { id: recoveryCode.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    return true;
  }

  async disable(userId: string, token: string): Promise<void> {
    const isValid = await this.verifyToken(userId, token);
    
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.$transaction([
      this.prisma.twoFactorSecret.delete({
        where: { userId },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false },
      }),
      this.prisma.recoveryCode.deleteMany({
        where: { userId },
      }),
    ]);
  }

  private generateRecoveryCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = this.encryptionService.generateToken(4)
        .toUpperCase()
        .slice(0, 8);
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }
}
