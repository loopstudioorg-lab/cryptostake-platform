import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Delete,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { SessionService } from './session.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser, CurrentUserData } from './decorators/current-user.decorator';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  Enable2faDto,
  Disable2faDto,
  AuthResponseDto,
  TwoFactorSetupResponseDto,
  TwoFactorVerifyResponseDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private authService: AuthService,
    private twoFactorService: TwoFactorService,
    private sessionService: SessionService,
  ) {}

  @Post('register')
  @Public()
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 per minute
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async register(@Body() dto: RegisterDto, @Req() req: Request): Promise<AuthResponseDto> {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.register(dto, ip, userAgent);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 per minute
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.login(dto, ip, userAgent);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 per minute
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<AuthResponseDto> {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    return this.authService.refresh(dto, ip, userAgent);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session' })
  async logout(@CurrentUser() user: CurrentUserData): Promise<void> {
    await this.authService.logout(user.sessionId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout all sessions except current' })
  async logoutAll(@CurrentUser() user: CurrentUserData): Promise<void> {
    await this.authService.logoutAllDevices(user.id, user.sessionId);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active sessions' })
  async getSessions(@CurrentUser('id') userId: string) {
    const sessions = await this.sessionService.getUserSessions(userId);
    return sessions.map(session => ({
      id: session.id,
      deviceName: session.deviceName,
      ipAddress: session.ipAddress,
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
    }));
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<void> {
    // Verify session belongs to user
    const sessions = await this.sessionService.getUserSessions(user.id);
    const session = sessions.find(s => s.id === sessionId);
    
    if (session) {
      await this.sessionService.revokeSession(sessionId);
    }
  }

  // Two-Factor Authentication
  @Post('2fa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize 2FA setup' })
  @ApiResponse({ status: 201, type: TwoFactorSetupResponseDto })
  async setup2fa(@CurrentUser('id') userId: string): Promise<TwoFactorSetupResponseDto> {
    return this.twoFactorService.generateSecret(userId);
  }

  @Post('2fa/verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify and enable 2FA' })
  @ApiResponse({ status: 200, type: TwoFactorVerifyResponseDto })
  async verify2fa(
    @CurrentUser('id') userId: string,
    @Body() dto: Enable2faDto,
  ): Promise<TwoFactorVerifyResponseDto> {
    const recoveryCodes = await this.twoFactorService.verifyAndEnable(userId, dto.totpCode);
    return { recoveryCodes };
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA' })
  async disable2fa(
    @CurrentUser('id') userId: string,
    @Body() dto: Disable2faDto,
  ): Promise<void> {
    await this.twoFactorService.disable(userId, dto.totpCode);
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
