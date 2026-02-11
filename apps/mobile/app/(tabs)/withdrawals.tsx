import { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth';
import { api } from '../../src/lib/api';
import { formatNumber, formatRelativeTime, shortenAddress } from '../../src/lib/utils';

export default function WithdrawalsScreen() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  
  const [amount, setAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [notes, setNotes] = useState('');

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ['withdrawals'],
    queryFn: () => api.getWithdrawals(accessToken!),
    enabled: !!accessToken,
  });

  const { data: balances } = useQuery({
    queryKey: ['balances'],
    queryFn: () => api.getBalances(accessToken!),
    enabled: !!accessToken,
  });

  const createWithdrawal = useMutation({
    mutationFn: () => api.createWithdrawal(accessToken!, {
      assetId: 'placeholder-asset-id', // Would be selected from balances
      chainId: 'placeholder-chain-id',
      amount,
      destinationAddress,
      userNotes: notes,
      idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      Alert.alert('Success', 'Withdrawal request submitted. Admin review required.');
      setAmount('');
      setDestinationAddress('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'PAID_MANUALLY':
        return 'bg-green-500/20 text-green-500';
      case 'REJECTED':
      case 'FAILED':
        return 'bg-red-500/20 text-red-500';
      case 'PENDING_REVIEW':
        return 'bg-yellow-500/20 text-yellow-500';
      default:
        return 'bg-blue-500/20 text-blue-500';
    }
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4">
        <Text className="text-white text-2xl font-bold mb-2">Withdraw</Text>
        
        {/* Warning */}
        <View className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
          <View className="flex-row items-start">
            <Ionicons name="alert-circle" size={20} color="#f59e0b" />
            <Text className="text-yellow-500 text-sm ml-2 flex-1">
              Withdrawals require admin review. Processing time may vary. This is not an instant withdrawal.
            </Text>
          </View>
        </View>

        {/* Withdrawal Form */}
        <View className="bg-surface rounded-xl p-4 mb-4">
          <Text className="text-white font-bold mb-3">New Withdrawal Request</Text>
          
          <View className="mb-3">
            <Text className="text-gray-400 text-sm mb-1">Amount</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-white"
              placeholder="0.00"
              placeholderTextColor="#64748b"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>

          <View className="mb-3">
            <Text className="text-gray-400 text-sm mb-1">Destination Address</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-white"
              placeholder="0x..."
              placeholderTextColor="#64748b"
              value={destinationAddress}
              onChangeText={setDestinationAddress}
              autoCapitalize="none"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-1">Notes (optional)</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-white"
              placeholder="Any additional information"
              placeholderTextColor="#64748b"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          <TouchableOpacity
            onPress={() => createWithdrawal.mutate()}
            disabled={createWithdrawal.isPending || !amount || !destinationAddress}
            className={`bg-primary rounded-xl py-3 items-center ${
              createWithdrawal.isPending ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-white font-semibold">
              {createWithdrawal.isPending ? 'Submitting...' : 'Submit Withdrawal Request'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Withdrawals */}
        <Text className="text-white font-bold text-lg mb-3">Withdrawal History</Text>

        {(withdrawals as any)?.map((withdrawal: any) => (
          <View key={withdrawal.id} className="bg-surface rounded-xl p-4 mb-2">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-white font-medium">
                {formatNumber(withdrawal.amount)} {withdrawal.asset?.symbol}
              </Text>
              <Text className={`text-xs px-2 py-1 rounded ${getStatusColor(withdrawal.status)}`}>
                {withdrawal.status.replace(/_/g, ' ')}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-gray-400 text-xs">
                To: {shortenAddress(withdrawal.destinationAddress, 6)}
              </Text>
              <Text className="text-gray-400 text-xs">
                {formatRelativeTime(withdrawal.createdAt)}
              </Text>
            </View>
          </View>
        ))}

        {!withdrawals?.length && !isLoading && (
          <View className="bg-surface rounded-xl p-8 items-center">
            <Ionicons name="receipt-outline" size={48} color="#64748b" />
            <Text className="text-gray-400 mt-3">No withdrawals yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
