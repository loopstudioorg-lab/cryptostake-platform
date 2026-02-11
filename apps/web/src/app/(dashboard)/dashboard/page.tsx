'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber, formatRelativeTime, getStatusColor } from '@/lib/utils';
import Link from 'next/link';
import {
  Wallet,
  TrendingUp,
  PiggyBank,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
} from 'lucide-react';

export default function DashboardPage() {
  const { accessToken } = useAuthStore();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(accessToken!),
    enabled: !!accessToken,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-24 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: 'Available Balance',
      value: formatNumber(dashboard?.availableBalance || '0'),
      icon: Wallet,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Staked Balance',
      value: formatNumber(dashboard?.stakedBalance || '0'),
      icon: PiggyBank,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Accrued Rewards',
      value: formatNumber(dashboard?.accruedRewards || '0'),
      icon: TrendingUp,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: 'Pending Withdrawals',
      value: formatNumber(dashboard?.pendingWithdrawals || '0'),
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/dashboard/deposits">Deposit</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/pools">Stake</Link>
          </Button>
        </div>
      </div>

      {/* Notice */}
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            Withdrawals require admin review. Processing time may vary. This is not an instant withdrawal.
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
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
        {/* Active Stakes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Active Stakes</CardTitle>
              <CardDescription>Your current staking positions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/stakes">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dashboard?.activeStakes?.length ? (
              <div className="space-y-4">
                {dashboard.activeStakes.slice(0, 3).map((stake: any) => (
                  <div
                    key={stake.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{stake.pool?.name || 'Staking Pool'}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatNumber(stake.amount)} {stake.pool?.asset?.symbol || 'TOKEN'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-500">
                        +{formatNumber(stake.currentAccruedRewards || stake.rewardsAccrued)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stake.pool?.currentApr}% APR
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <PiggyBank className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No active stakes</p>
                <Button variant="link" asChild>
                  <Link href="/dashboard/pools">Start staking →</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard?.recentDeposits?.map((deposit: any) => (
                <div
                  key={deposit.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-500/10">
                      <ArrowDownRight className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">Deposit</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(deposit.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      +{formatNumber(deposit.amount)} {deposit.asset?.symbol}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(deposit.status)}`}>
                      {deposit.status}
                    </span>
                  </div>
                </div>
              ))}
              {dashboard?.recentWithdrawals?.map((withdrawal: any) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-orange-500/10">
                      <ArrowUpRight className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-medium">Withdrawal</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(withdrawal.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      -{formatNumber(withdrawal.amount)} {withdrawal.asset?.symbol}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(withdrawal.status)}`}>
                      {withdrawal.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {!dashboard?.recentDeposits?.length && !dashboard?.recentWithdrawals?.length && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
