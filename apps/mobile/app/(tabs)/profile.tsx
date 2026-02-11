import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/auth';
import { api } from '../../src/lib/api';
import { formatRelativeTime } from '../../src/lib/utils';

export default function ProfileScreen() {
  const { accessToken, logout } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.getProfile(accessToken!),
    enabled: !!accessToken,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.getSessions(accessToken!),
    enabled: !!accessToken,
  });

  const revokeSession = useMutation({
    mutationFn: (sessionId: string) => api.revokeSession(accessToken!, sessionId),
    onSuccess: () => {
      Alert.alert('Success', 'Session revoked successfully');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          }
        },
      ]
    );
  };

  const handleRevokeSession = (sessionId: string, isCurrent: boolean) => {
    if (isCurrent) {
      Alert.alert('Info', 'You cannot revoke your current session. Use logout instead.');
      return;
    }
    
    Alert.alert(
      'Revoke Session',
      'This will log out the device associated with this session.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Revoke', 
          style: 'destructive',
          onPress: () => revokeSession.mutate(sessionId)
        },
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4">
        <Text className="text-white text-2xl font-bold mb-4">Profile</Text>

        {/* User Info */}
        <View className="bg-surface rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-4">
            <View className="w-16 h-16 bg-primary/20 rounded-full items-center justify-center">
              <Ionicons name="person" size={32} color="#00d4aa" />
            </View>
            <View className="ml-4">
              <Text className="text-white text-lg font-bold">
                {(profile as any)?.firstName || 'User'} {(profile as any)?.lastName || ''}
              </Text>
              <Text className="text-gray-400">{(profile as any)?.email}</Text>
            </View>
          </View>
          
          <View className="flex-row items-center justify-between py-2 border-t border-border">
            <Text className="text-gray-400">Email Verified</Text>
            <View className="flex-row items-center">
              <Ionicons 
                name={(profile as any)?.isEmailVerified ? 'checkmark-circle' : 'close-circle'} 
                size={20} 
                color={(profile as any)?.isEmailVerified ? '#22c55e' : '#ef4444'} 
              />
              <Text className={`ml-1 ${(profile as any)?.isEmailVerified ? 'text-green-500' : 'text-red-500'}`}>
                {(profile as any)?.isEmailVerified ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
          
          <View className="flex-row items-center justify-between py-2 border-t border-border">
            <Text className="text-gray-400">Member Since</Text>
            <Text className="text-white">
              {(profile as any)?.createdAt ? formatRelativeTime((profile as any).createdAt) : '-'}
            </Text>
          </View>
        </View>

        {/* Security Section */}
        <Text className="text-white font-bold text-lg mb-3">Security</Text>
        
        <View className="bg-surface rounded-xl mb-4">
          <TouchableOpacity className="flex-row items-center justify-between p-4 border-b border-border">
            <View className="flex-row items-center">
              <Ionicons name="key-outline" size={20} color="#64748b" />
              <Text className="text-white ml-3">Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>
          
          <TouchableOpacity className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center">
              <Ionicons name="shield-checkmark-outline" size={20} color="#64748b" />
              <Text className="text-white ml-3">Two-Factor Authentication</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Active Sessions */}
        <Text className="text-white font-bold text-lg mb-3">Active Sessions</Text>
        
        <View className="bg-surface rounded-xl mb-4">
          {(sessions as any)?.map((session: any, index: number) => (
            <View 
              key={session.id} 
              className={`p-4 ${index !== 0 ? 'border-t border-border' : ''}`}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Ionicons 
                      name={session.isCurrent ? 'phone-portrait' : 'desktop-outline'} 
                      size={16} 
                      color={session.isCurrent ? '#00d4aa' : '#64748b'} 
                    />
                    <Text className="text-white ml-2 font-medium">
                      {session.userAgent?.slice(0, 30) || 'Unknown Device'}
                      {session.isCurrent && ' (Current)'}
                    </Text>
                  </View>
                  <Text className="text-gray-400 text-xs mt-1">
                    IP: {session.ip || 'Unknown'} • {formatRelativeTime(session.lastActive)}
                  </Text>
                </View>
                {!session.isCurrent && (
                  <TouchableOpacity 
                    onPress={() => handleRevokeSession(session.id, session.isCurrent)}
                    className="p-2"
                  >
                    <Ionicons name="close-circle-outline" size={24} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {!sessions?.length && !sessionsLoading && (
            <View className="p-4 items-center">
              <Text className="text-gray-400">No active sessions</Text>
            </View>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex-row items-center justify-center"
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text className="text-red-500 font-semibold ml-2">Logout</Text>
        </TouchableOpacity>

        <View className="h-20" />
      </View>
    </ScrollView>
  );
}
