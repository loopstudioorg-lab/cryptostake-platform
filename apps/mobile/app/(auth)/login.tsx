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

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needs2fa, setNeeds2fa] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    try {
      await login(email, password, totpCode || undefined);
      router.replace('/(tabs)/dashboard');
    } catch (error: any) {
      if (error.message?.includes('2FA')) {
        setNeeds2fa(true);
        Alert.alert('2FA Required', 'Please enter your authentication code');
      } else {
        Alert.alert('Login Failed', error.message);
      }
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
              Welcome Back
            </Text>
            <Text className="text-gray-400 text-center mb-6">
              Sign in to your account
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

            {needs2fa && (
              <View>
                <Text className="text-gray-400 mb-2">2FA Code</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-white"
                  placeholder="000000"
                  placeholderTextColor="#64748b"
                  value={totpCode}
                  onChangeText={setTotpCode}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            )}

            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              className={`bg-primary rounded-xl py-4 items-center ${
                isLoading ? 'opacity-50' : ''
              }`}
            >
              <Text className="text-white font-semibold text-lg">
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <View className="flex-row justify-center mt-4">
              <Text className="text-gray-400">Don't have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text className="text-primary font-semibold">Sign Up</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
