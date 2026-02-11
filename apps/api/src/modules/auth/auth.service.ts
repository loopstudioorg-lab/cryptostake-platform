import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from './session.service';
import { TwoFactorService } from './two-factor.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sessionId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private sessionService: SessionService,
    private twoFactorService: TwoFactorService,
  ) {}

  async register(dto: RegisterDto, ip: string, userAgent: string): Promise<AuthTokens> {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password with argon2
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        role: 'USER',
      },
    });

    // Create session and return tokens
    return this.createAuthTokens(user.id, user.email, user.role, ip, userAgent);
  }

  async login(dto: LoginDto, ip: string, userAgent: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        twoFactorSecret: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled && user.twoFactorSecret?.isVerified) {
      if (!dto.totpCode) {
        throw new BadRequestException('2FA code required');
      }

      const is2faValid = await this.twoFactorService.verifyToken(user.id, dto.totpCode);
      if (!is2faValid) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    // Check if admin requires 2FA
    if ((user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && !user.twoFactorEnabled) {
      throw new ForbiddenException('Admin accounts require 2FA to be enabled');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create session and return tokens
    return this.createAuthTokens(user.id, user.email, user.role, ip, userAgent);
  }

  async refresh(dto: RefreshTokenDto, ip: string, userAgent: string): Promise<AuthTokens> {
    // Validate refresh token
    const session = await this.sessionService.validateRefreshToken(dto.refreshToken);
    
    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or disabled');
    }

    // Rotate refresh token
    await this.sessionService.revokeSession(session.id);

    // Create new session
    return this.createAuthTokens(user.id, user.email, user.role, ip, userAgent);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionService.revokeSession(sessionId);
  }

  async logoutAllDevices(userId: string, exceptSessionId?: string): Promise<void> {
    await this.sessionService.revokeAllUserSessions(userId, exceptSessionId);
  }

  private async createAuthTokens(
    userId: string,
    email: string,
    role: string,
    ip: string,
    userAgent: string,
  ): Promise<AuthTokens> {
    const sessionId = uuidv4();
    const refreshToken = uuidv4();

    // Create session
    await this.sessionService.createSession({
      id: sessionId,
      userId,
      refreshToken,
      ipAddress: ip,
      userAgent,
    });

    // Generate access token
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
      sessionId,
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.parseExpiresIn(this.configService.get('jwt.accessExpiresIn') || '15m');

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private parseExpiresIn(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const num = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return num;
      case 'm': return num * 60;
      case 'h': return num * 3600;
      case 'd': return num * 86400;
      default: return 900;
    }
  }

  async validateUser(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    return user?.isActive ?? false;
  }
}
