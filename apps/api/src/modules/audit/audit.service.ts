import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogParams {
  actorId?: string;
  actorEmail?: string;
  action: string;
  entity: string;
  entityId: string;
  before?: any;
  after?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: AuditLogParams) {
    // Get actor email if not provided
    let actorEmail = params.actorEmail;
    if (params.actorId && !actorEmail) {
      const actor = await this.prisma.user.findUnique({
        where: { id: params.actorId },
        select: { email: true },
      });
      actorEmail = actor?.email;
    }

    return this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        actorEmail,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before ? this.sanitize(params.before) : null,
        after: params.after ? this.sanitize(params.after) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  async getLogs(options?: {
    page?: number;
    limit?: number;
    actorId?: string;
    action?: string;
    entity?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (options?.actorId) {
      where.actorId = options.actorId;
    }
    if (options?.action) {
      where.action = { contains: options.action, mode: 'insensitive' };
    }
    if (options?.entity) {
      where.entity = options.entity;
    }
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { email: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEntityHistory(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      include: {
        actor: {
          select: { email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Remove sensitive fields from audit data
  private sanitize(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'passwordHash',
      'password',
      'encryptedSecret',
      'encryptedPrivateKey',
      'refreshToken',
      'accessToken',
    ];

    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Handle Decimal objects
    for (const key in sanitized) {
      if (sanitized[key]?.constructor?.name === 'Decimal') {
        sanitized[key] = sanitized[key].toString();
      }
    }

    return sanitized;
  }
}
