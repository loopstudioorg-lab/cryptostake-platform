import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuthStore } from '../../src/store/auth';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    try {
      await register(email, password);
      router.replace('/(tabs)/dashboard');
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 pt-20 pb-10 bg-background">
          {/* Logo */}
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center mb-4">
              <Ionicons name="wallet" size={32} color="white" />
            </View>
            <Text className="text-2xl font-bold text-white">CryptoStake</Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            <Text className="text-3xl font-bold text-white text-center mb-2">
              Create Account
            </Text>
            <Text className="text-gray-400 text-center mb-6">
              Start staking and earning rewards
            </Text>

            <View>
              <Text className="text-gray-400 mb-2">Email</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-white"
                placeholder="you@example.com"
                placeholderTextColor="#64748b"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text className="text-gray-400 mb-2">Password</Text>
              <View className="relative">
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-white pr-12"
                  placeholder="••••••••"
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3"
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text className="text-gray-400 mb-2">Confirm Password</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-white"
                placeholder="••••••••"
                placeholderTextColor="#64748b"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <View className="bg-surface border border-border rounded-xl p-4">
              <Text className="text-gray-400 text-xs leading-5">
                By creating an account, you agree to our Terms of Service and
                Privacy Policy. This is a custodial platform - your assets are
                held in platform-controlled wallets. Withdrawals require admin
                review.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleRegister}
              disabled={isLoading}
              className={`bg-primary rounded-xl py-4 items-center ${
                isLoading ? 'opacity-50' : ''
              }`}
            >
              <Text className="text-white font-semibold text-lg">
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <View className="flex-row justify-center mt-4">
              <Text className="text-gray-400">Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text className="text-primary font-semibold">Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
