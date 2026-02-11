'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, formatRelativeTime, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Users, PiggyBank, ArrowUpFromLine, Wallet, AlertTriangle } from 'lucide-react';

export default function AdminDashboardPage() {
  const { accessToken } = useAuthStore();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.adminGetDashboard(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const stats = [
    {
      title: 'Total Users',
      value: dashboard?.totalUsers || 0,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Active Stakes',
      value: dashboard?.activeStakes || 0,
      icon: PiggyBank,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Value Locked',
      value: formatCurrency(dashboard?.totalValueLocked || '0'),
      icon: Wallet,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Pending Withdrawals',
      value: dashboard?.pendingWithdrawals || 0,
      icon: ArrowUpFromLine,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      alert: (dashboard?.pendingWithdrawals || 0) > 0,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        {dashboard?.pendingWithdrawals > 0 && (
          <Link
            href="/admin/withdrawals"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition"
          >
            <AlertTriangle className="h-4 w-4" />
            {dashboard.pendingWithdrawals} pending withdrawals
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className={stat.alert ? 'border-orange-500/50' : ''}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Withdrawals Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Withdrawals Value</CardTitle>
            <CardDescription>Total amount waiting for review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-500">
              {formatCurrency(dashboard?.totalWithdrawalsPending || '0')}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Across {dashboard?.pendingWithdrawals || 0} requests
            </p>
          </CardContent>
        </Card>

        {/* Recent Audit Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest admin actions</CardDescription>
            </div>
            <Link href="/admin/audit-logs" className="text-sm text-primary hover:underline">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard?.recentActivity?.slice(0, 5).map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">{log.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.actor?.email || 'System'} • {log.entity}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </div>
              ))}
              {!dashboard?.recentActivity?.length && (
                <p className="text-center text-muted-foreground py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Link
              href="/admin/withdrawals?status=PENDING_REVIEW"
              className="p-4 rounded-lg border hover:bg-muted/50 transition text-center"
            >
              <ArrowUpFromLine className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <p className="font-medium">Review Withdrawals</p>
            </Link>
            <Link
              href="/admin/users"
              className="p-4 rounded-lg border hover:bg-muted/50 transition text-center"
            >
              <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="font-medium">Manage Users</p>
            </Link>
            <Link
              href="/admin/pools"
              className="p-4 rounded-lg border hover:bg-muted/50 transition text-center"
            >
              <PiggyBank className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="font-medium">Manage Pools</p>
            </Link>
            <Link
              href="/admin/treasury"
              className="p-4 rounded-lg border hover:bg-muted/50 transition text-center"
            >
              <Wallet className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <p className="font-medium">View Treasury</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
