import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth';
import { api } from '../../src/lib/api';
import { formatNumber, formatRelativeTime } from '../../src/lib/utils';

export default function DashboardScreen() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(accessToken!),
    enabled: !!accessToken,
  });

  const stats = [
    {
      label: 'Available',
      value: formatNumber(dashboard?.availableBalance || '0'),
      icon: 'wallet',
      color: '#3b82f6',
    },
    {
      label: 'Staked',
      value: formatNumber(dashboard?.stakedBalance || '0'),
      icon: 'layers',
      color: '#22c55e',
    },
    {
      label: 'Rewards',
      value: formatNumber(dashboard?.accruedRewards || '0'),
      icon: 'trending-up',
      color: '#f59e0b',
    },
    {
      label: 'Pending',
      value: formatNumber(dashboard?.pendingWithdrawals || '0'),
      icon: 'time',
      color: '#f97316',
    },
  ];

  return (
    <ScrollView
      className="flex-1 bg-background"
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#22c55e" />
      }
    >
      <View className="p-4">
        {/* Notice */}
        <View className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4 flex-row items-center">
          <Ionicons name="alert-circle" size={20} color="#f59e0b" />
          <Text className="text-yellow-500 text-xs ml-2 flex-1">
            Withdrawals require admin review. Processing time may vary.
          </Text>
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap -mx-1 mb-6">
          {stats.map((stat) => (
            <View key={stat.label} className="w-1/2 px-1 mb-2">
              <View className="bg-surface rounded-xl p-4">
                <View className="flex-row items-center mb-2">
                  <View
                    style={{ backgroundColor: `${stat.color}20` }}
                    className="w-8 h-8 rounded-lg items-center justify-center"
                  >
                    <Ionicons name={stat.icon as any} size={18} color={stat.color} />
                  </View>
                </View>
                <Text className="text-gray-400 text-xs">{stat.label}</Text>
                <Text className="text-white text-lg font-bold">{stat.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View className="flex-row mb-6">
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/deposits')}
            className="flex-1 bg-primary rounded-xl py-3 items-center mr-2"
          >
            <Text className="text-white font-semibold">Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/pools')}
            className="flex-1 bg-surface border border-border rounded-xl py-3 items-center ml-2"
          >
            <Text className="text-white font-semibold">Stake</Text>
          </TouchableOpacity>
        </View>

        {/* Active Stakes */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white font-bold text-lg">Active Stakes</Text>
            <TouchableOpacity>
              <Text className="text-primary text-sm">View All</Text>
            </TouchableOpacity>
          </View>

          {dashboard?.activeStakes?.length ? (
            dashboard.activeStakes.slice(0, 3).map((stake: any) => (
              <View key={stake.id} className="bg-surface rounded-xl p-4 mb-2">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-medium">
                      {stake.pool?.name || 'Staking Pool'}
                    </Text>
                    <Text className="text-gray-400 text-sm">
                      {formatNumber(stake.amount)} {stake.pool?.asset?.symbol || 'TOKEN'}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-green-500 text-sm">
                      +{formatNumber(stake.rewardsAccrued || '0')}
                    </Text>
                    <Text className="text-gray-400 text-xs">
                      {stake.pool?.currentApr}% APR
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View className="bg-surface rounded-xl p-8 items-center">
              <Ionicons name="layers-outline" size={40} color="#64748b" />
              <Text className="text-gray-400 mt-2">No active stakes</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/pools')}
                className="mt-3"
              >
                <Text className="text-primary">Start staking →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <View>
          <Text className="text-white font-bold text-lg mb-3">Recent Activity</Text>

          {dashboard?.recentDeposits?.map((deposit: any) => (
            <View key={deposit.id} className="bg-surface rounded-xl p-4 mb-2 flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center">
                <Ionicons name="arrow-down" size={20} color="#22c55e" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-white font-medium">Deposit</Text>
                <Text className="text-gray-400 text-xs">
                  {formatRelativeTime(deposit.createdAt)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-white font-medium">
                  +{formatNumber(deposit.amount)} {deposit.asset?.symbol}
                </Text>
                <Text
                  className={`text-xs ${
                    deposit.status === 'CONFIRMED' ? 'text-green-500' : 'text-yellow-500'
                  }`}
                >
                  {deposit.status}
                </Text>
              </View>
            </View>
          ))}

          {dashboard?.recentWithdrawals?.map((withdrawal: any) => (
            <View key={withdrawal.id} className="bg-surface rounded-xl p-4 mb-2 flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-orange-500/20 items-center justify-center">
                <Ionicons name="arrow-up" size={20} color="#f97316" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-white font-medium">Withdrawal</Text>
                <Text className="text-gray-400 text-xs">
                  {formatRelativeTime(withdrawal.createdAt)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-white font-medium">
                  -{formatNumber(withdrawal.amount)} {withdrawal.asset?.symbol}
                </Text>
                <Text className="text-xs text-yellow-500">
                  {withdrawal.status.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
          ))}

          {!dashboard?.recentDeposits?.length && !dashboard?.recentWithdrawals?.length && (
            <View className="bg-surface rounded-xl p-8 items-center">
              <Text className="text-gray-400">No recent activity</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
