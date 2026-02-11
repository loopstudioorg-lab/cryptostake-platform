import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { formatNumber, formatPercentage } from '../../src/lib/utils';

export default function PoolsScreen() {
  const { data: pools, isLoading, refetch } = useQuery({
    queryKey: ['pools'],
    queryFn: () => api.getPools(),
  });

  return (
    <ScrollView
      className="flex-1 bg-background"
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#22c55e" />
      }
    >
      <View className="p-4">
        <Text className="text-white text-2xl font-bold mb-4">Staking Pools</Text>

        {(pools as any)?.map((pool: any) => (
          <TouchableOpacity key={pool.id} className="bg-surface rounded-xl p-4 mb-3">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
                  <Text className="text-white font-bold">{pool.asset?.symbol?.[0]}</Text>
                </View>
                <View className="ml-3">
                  <Text className="text-white font-medium">{pool.name}</Text>
                  <Text className="text-gray-400 text-sm">{pool.asset?.symbol}</Text>
                </View>
              </View>
              <View className="bg-green-500/20 px-3 py-1 rounded-full">
                <Text className="text-green-500 font-bold">
                  {formatPercentage(pool.currentApr)} APR
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between">
              <View>
                <Text className="text-gray-400 text-xs">Type</Text>
                <Text className="text-white">{pool.type}</Text>
              </View>
              <View>
                <Text className="text-gray-400 text-xs">Lock Period</Text>
                <Text className="text-white">{pool.lockDays ? `${pool.lockDays} days` : 'Flexible'}</Text>
              </View>
              <View>
                <Text className="text-gray-400 text-xs">TVL</Text>
                <Text className="text-white">{formatNumber(pool.totalStaked)}</Text>
              </View>
            </View>

            <TouchableOpacity className="bg-primary rounded-lg py-2 mt-3 items-center">
              <Text className="text-white font-semibold">Stake Now</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {!pools?.length && !isLoading && (
          <View className="bg-surface rounded-xl p-8 items-center">
            <Ionicons name="layers-outline" size={48} color="#64748b" />
            <Text className="text-gray-400 mt-3">No pools available</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
