import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Session } from '@prisma/client';
import { EncryptionService } from './encryption.service';
import * as UAParser from 'ua-parser-js';

interface CreateSessionParams {
  id: string;
  userId: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class SessionService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {}

  async createSession(params: CreateSessionParams): Promise<Session> {
    const { id, userId, refreshToken, ipAddress, userAgent } = params;
    
    // Parse user agent for device name
    const parser = new UAParser.UAParser(userAgent);
    const result = parser.getResult();
    const deviceName = this.formatDeviceName(result);

    // Calculate expiry (7 days by default)
    const expiresIn = this.parseExpiresIn(
      this.configService.get('jwt.refreshExpiresIn') || '7d'
    );
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Hash the refresh token before storing
    const hashedRefreshToken = this.encryptionService.hash(refreshToken);

    return this.prisma.session.create({
      data: {
        id,
        userId,
        refreshToken: hashedRefreshToken,
        deviceName,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });
  }

  async validateRefreshToken(refreshToken: string): Promise<Session | null> {
    const hashedToken = this.encryptionService.hash(refreshToken);
    
    const session = await this.prisma.session.findUnique({
      where: { refreshToken: hashedToken },
    });

    if (!session) return null;
    if (session.isRevoked) return null;
    if (session.expiresAt < new Date()) return null;

    // Update last active
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    return session;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        isRevoked: false,
        ...(exceptSessionId && { id: { not: exceptSessionId } }),
      },
      data: { isRevoked: true },
    });
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async cleanExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true },
        ],
      },
    });
    return result.count;
  }

  private formatDeviceName(result: UAParser.IResult): string {
    const parts: string[] = [];
    
    if (result.browser.name) {
      parts.push(result.browser.name);
    }
    
    if (result.os.name) {
      parts.push(`on ${result.os.name}`);
      if (result.os.version) {
        parts.push(result.os.version);
      }
    }
    
    if (result.device.type) {
      parts.push(`(${result.device.type})`);
    }

    return parts.length > 0 ? parts.join(' ') : 'Unknown Device';
  }

  private parseExpiresIn(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) return 604800; // Default 7 days

    const num = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return num;
      case 'm': return num * 60;
      case 'h': return num * 3600;
      case 'd': return num * 86400;
      default: return 604800;
    }
  }
}
