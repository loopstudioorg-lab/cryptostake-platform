import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtPayload) {
    // Check if user exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or disabled');
    }

    // Check if session is still valid
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || session.isRevoked) {
      throw new UnauthorizedException('Session expired');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: payload.sessionId,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }
}
