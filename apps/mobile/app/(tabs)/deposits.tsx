import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth';
import { api } from '../../src/lib/api';
import { formatNumber, formatRelativeTime, shortenAddress } from '../../src/lib/utils';

export default function DepositsScreen() {
  const { accessToken } = useAuthStore();
  const [selectedChain, setSelectedChain] = useState<string | null>(null);

  const { data: deposits, isLoading: depositsLoading } = useQuery({
    queryKey: ['deposits'],
    queryFn: () => api.getDeposits(accessToken!),
    enabled: !!accessToken,
  });

  const { data: depositAddress, isLoading: addressLoading } = useQuery({
    queryKey: ['deposit-address', selectedChain],
    queryFn: () => api.getDepositAddress(accessToken!, selectedChain!),
    enabled: !!accessToken && !!selectedChain,
  });

  const chains = [
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    { id: 'bsc', name: 'BNB Chain', symbol: 'BNB' },
    { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
  ];

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4">
        <Text className="text-white text-2xl font-bold mb-2">Deposit</Text>
        <Text className="text-gray-400 mb-4">
          Select a network to get your deposit address
        </Text>

        {/* Chain Selection */}
        <View className="flex-row mb-4">
          {chains.map((chain) => (
            <TouchableOpacity
              key={chain.id}
              onPress={() => setSelectedChain(chain.id)}
              className={`flex-1 mx-1 p-3 rounded-xl items-center ${
                selectedChain === chain.id ? 'bg-primary' : 'bg-surface'
              }`}
            >
              <Text className={`font-semibold ${
                selectedChain === chain.id ? 'text-white' : 'text-gray-400'
              }`}>
                {chain.symbol}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Deposit Address */}
        {selectedChain && (
          <View className="bg-surface rounded-xl p-4 mb-4">
            {addressLoading ? (
              <Text className="text-gray-400 text-center py-4">Loading address...</Text>
            ) : depositAddress ? (
              <>
                <Text className="text-gray-400 text-center mb-3">
                  Send only {chains.find(c => c.id === selectedChain)?.symbol} to this address
                </Text>
                
                <View className="bg-background rounded-lg p-4 mb-3">
                  <Text className="text-white text-center font-mono text-sm" selectable>
                    {(depositAddress as any).address}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => Alert.alert('Copied', 'Address copied to clipboard')}
                  className="bg-primary/20 rounded-lg py-3 items-center flex-row justify-center"
                >
                  <Ionicons name="copy" size={18} color="#22c55e" />
                  <Text className="text-primary font-semibold ml-2">Copy Address</Text>
                </TouchableOpacity>

                <View className="bg-yellow-500/10 rounded-lg p-3 mt-4">
                  <Text className="text-yellow-500 text-xs text-center">
                    ⚠️ Send only supported tokens. Sending unsupported tokens may result in permanent loss.
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        )}

        {/* Recent Deposits */}
        <Text className="text-white font-bold text-lg mb-3">Recent Deposits</Text>
        
        {(deposits as any)?.map((deposit: any) => (
          <View key={deposit.id} className="bg-surface rounded-xl p-4 mb-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center">
                  <Ionicons name="arrow-down" size={20} color="#22c55e" />
                </View>
                <View className="ml-3">
                  <Text className="text-white font-medium">
                    {formatNumber(deposit.amount)} {deposit.asset?.symbol}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    {shortenAddress(deposit.txHash)}
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <Text className={`text-xs px-2 py-1 rounded ${
                  deposit.status === 'CONFIRMED' 
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-yellow-500/20 text-yellow-500'
                }`}>
                  {deposit.status}
                </Text>
                <Text className="text-gray-400 text-xs mt-1">
                  {formatRelativeTime(deposit.createdAt)}
                </Text>
              </View>
            </View>
          </View>
        ))}

        {!deposits?.length && !depositsLoading && (
          <View className="bg-surface rounded-xl p-8 items-center">
            <Ionicons name="wallet-outline" size={48} color="#64748b" />
            <Text className="text-gray-400 mt-3">No deposits yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
