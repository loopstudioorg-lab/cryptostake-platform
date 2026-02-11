const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

interface RequestOptions extends RequestInit {
  token?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Auth
  async register(email: string, password: string) {
    return this.request<{ accessToken: string; refreshToken: string }>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async login(email: string, password: string, totpCode?: string) {
    return this.request<{ accessToken: string; refreshToken: string }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totpCode }),
    });
  }

  async refresh(refreshToken: string) {
    return this.request<{ accessToken: string; refreshToken: string }>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(token: string) {
    return this.request('/v1/auth/logout', { method: 'POST', token });
  }

  async getSessions(token: string) {
    return this.request('/v1/auth/sessions', { token });
  }

  // User
  async getProfile(token: string) {
    return this.request('/v1/user/profile', { token });
  }

  async getDashboard(token: string) {
    return this.request('/v1/user/dashboard', { token });
  }

  async getBalances(token: string) {
    return this.request('/v1/user/balances', { token });
  }

  async getNotifications(token: string) {
    return this.request('/v1/user/notifications', { token });
  }

  // Pools
  async getPools() {
    return this.request('/v1/pools');
  }

  async getPool(id: string) {
    return this.request(`/v1/pools/${id}`);
  }

  // Stakes
  async getStakes(token: string) {
    return this.request('/v1/stakes', { token });
  }

  async createStake(token: string, poolId: string, amount: string) {
    return this.request('/v1/stakes', {
      method: 'POST',
      token,
      body: JSON.stringify({ poolId, amount }),
    });
  }

  async unstake(token: string, stakeId: string) {
    return this.request(`/v1/stakes/${stakeId}/unstake`, { method: 'POST', token });
  }

  async claimRewards(token: string, stakeId: string) {
    return this.request(`/v1/stakes/${stakeId}/claim`, { method: 'POST', token });
  }

  // Deposits
  async getDepositAddress(token: string, chainId: string) {
    return this.request('/v1/deposits/address', {
      method: 'POST',
      token,
      body: JSON.stringify({ chainId }),
    });
  }

  async getDeposits(token: string) {
    return this.request('/v1/deposits', { token });
  }

  // Withdrawals
  async getWithdrawals(token: string) {
    return this.request('/v1/withdrawals', { token });
  }

  async createWithdrawal(
    token: string,
    params: {
      assetId: string;
      chainId: string;
      amount: string;
      destinationAddress: string;
      userNotes?: string;
      idempotencyKey: string;
    }
  ) {
    return this.request('/v1/withdrawals', {
      method: 'POST',
      token,
      body: JSON.stringify(params),
    });
  }
}

export const api = new ApiClient(API_URL);
