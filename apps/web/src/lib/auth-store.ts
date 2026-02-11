'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';

interface User {
  id: string;
  email: string;
  role: string;
  twoFactorEnabled: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email: string, password: string, totpCode?: string) => {
        set({ isLoading: true });
        try {
          const response = await api.login(email, password, totpCode);
          const profile = await api.getProfile(response.accessToken);
          
          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            user: profile as User,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.register(email, password);
          const profile = await api.getProfile(response.accessToken);
          
          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            user: profile as User,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        const { accessToken } = get();
        if (accessToken) {
          try {
            await api.logout(accessToken);
          } catch {
            // Ignore logout errors
          }
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      refresh: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;

        try {
          const response = await api.refresh(refreshToken);
          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          });
          return true;
        } catch {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
          return false;
        }
      },

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Helper hook for getting auth token
export function useAuthToken() {
  return useAuthStore((state) => state.accessToken);
}

// Helper hook for checking if user is admin
export function useIsAdmin() {
  const user = useAuthStore((state) => state.user);
  return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
}
