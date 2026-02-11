import { Controller, Get, Put, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}

@ApiTags('user')
@Controller({ path: 'user', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(userId, dto);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get user dashboard' })
  async getDashboard(@CurrentUser('id') userId: string) {
    return this.userService.getDashboard(userId);
  }

  @Get('balances')
  @ApiOperation({ summary: 'Get user balances' })
  async getBalances(@CurrentUser('id') userId: string) {
    return this.userService.getBalances(userId);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get user notifications' })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return this.userService.getNotifications(userId, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('notifications/:id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markNotificationRead(
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.userService.markNotificationRead(userId, notificationId);
  }

  @Post('notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllNotificationsRead(@CurrentUser('id') userId: string) {
    return this.userService.markAllNotificationsRead(userId);
  }
}
