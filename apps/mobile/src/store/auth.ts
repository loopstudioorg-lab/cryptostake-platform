import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../lib/api';

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
  
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  loadStoredAuth: () => Promise<void>;
}

const STORAGE_KEY = 'auth_data';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  isAuthenticated: false,

  loadStoredAuth: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
          isAuthenticated: !!data.accessToken,
          isLoading: false,
        });
        
        // Try to refresh if we have a refresh token
        if (data.refreshToken) {
          const refreshed = await get().refresh();
          if (!refreshed) {
            await get().logout();
          }
        }
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string, totpCode?: string) => {
    set({ isLoading: true });
    try {
      const response = await api.login(email, password, totpCode);
      const profile = await api.getProfile(response.accessToken);
      
      const authData = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: profile as User,
      };
      
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(authData));
      
      set({
        ...authData,
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
      
      const authData = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: profile as User,
      };
      
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(authData));
      
      set({
        ...authData,
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
    
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    
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
      const profile = await api.getProfile(response.accessToken);
      
      const authData = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: profile as User,
      };
      
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(authData));
      
      set({
        ...authData,
        isAuthenticated: true,
      });
      
      return true;
    } catch {
      return false;
    }
  },
}));
