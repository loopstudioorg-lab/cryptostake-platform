const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface RequestOptions extends RequestInit {
  token?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
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

  // Auth endpoints
  async register(email: string, password: string) {
    return this.request<{ accessToken: string; refreshToken: string; expiresIn: number }>(
      '/v1/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
  }

  async login(email: string, password: string, totpCode?: string) {
    return this.request<{ accessToken: string; refreshToken: string; expiresIn: number }>(
      '/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, totpCode }),
      }
    );
  }

  async refresh(refreshToken: string) {
    return this.request<{ accessToken: string; refreshToken: string; expiresIn: number }>(
      '/v1/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }
    );
  }

  async logout(token: string) {
    return this.request('/v1/auth/logout', {
      method: 'POST',
      token,
    });
  }

  async getSessions(token: string) {
    return this.request('/v1/auth/sessions', { token });
  }

  async setup2fa(token: string) {
    return this.request<{ secret: string; qrCodeUrl: string }>(
      '/v1/auth/2fa/setup',
      { method: 'POST', token }
    );
  }

  async verify2fa(token: string, totpCode: string) {
    return this.request<{ recoveryCodes: string[] }>(
      '/v1/auth/2fa/verify',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ totpCode }),
      }
    );
  }

  // User endpoints
  async getProfile(token: string) {
    return this.request('/v1/user/profile', { token });
  }

  async getDashboard(token: string) {
    return this.request('/v1/user/dashboard', { token });
  }

  async getBalances(token: string) {
    return this.request('/v1/user/balances', { token });
  }

  async getNotifications(token: string, unreadOnly = false) {
    return this.request(`/v1/user/notifications?unreadOnly=${unreadOnly}`, { token });
  }

  // Pools endpoints
  async getPools() {
    return this.request('/v1/pools');
  }

  async getPool(id: string) {
    return this.request(`/v1/pools/${id}`);
  }

  async calculateRewards(poolId: string, amount: string, days: number) {
    return this.request(`/v1/pools/${poolId}/calculator?amount=${amount}&days=${days}`);
  }

  // Stakes endpoints
  async getStakes(token: string) {
    return this.request('/v1/stakes', { token });
  }

  async getStakeSummary(token: string) {
    return this.request('/v1/stakes/summary', { token });
  }

  async createStake(token: string, poolId: string, amount: string) {
    return this.request('/v1/stakes', {
      method: 'POST',
      token,
      body: JSON.stringify({ poolId, amount }),
    });
  }

  async unstake(token: string, stakeId: string) {
    return this.request(`/v1/stakes/${stakeId}/unstake`, {
      method: 'POST',
      token,
    });
  }

  async claimRewards(token: string, stakeId: string) {
    return this.request(`/v1/stakes/${stakeId}/claim`, {
      method: 'POST',
      token,
    });
  }

  // Deposits endpoints
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

  // Withdrawals endpoints
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

  // Admin endpoints
  async adminGetDashboard(token: string) {
    return this.request('/v1/admin/dashboard', { token });
  }

  async adminGetUsers(token: string, params?: { page?: number; search?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.search) query.set('search', params.search);
    return this.request(`/v1/admin/users?${query}`, { token });
  }

  async adminGetPools(token: string) {
    return this.request('/v1/admin/pools', { token });
  }

  async adminCreatePool(token: string, data: any) {
    return this.request('/v1/admin/pools', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  }

  async adminGetWithdrawals(token: string, params?: { status?: string; page?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    return this.request(`/v1/admin/withdrawals?${query}`, { token });
  }

  async adminApproveWithdrawal(token: string, id: string, adminNotes?: string) {
    return this.request(`/v1/admin/withdrawals/${id}/approve`, {
      method: 'POST',
      token,
      body: JSON.stringify({ adminNotes }),
    });
  }

  async adminRejectWithdrawal(token: string, id: string, adminNotes: string) {
    return this.request(`/v1/admin/withdrawals/${id}/reject`, {
      method: 'POST',
      token,
      body: JSON.stringify({ adminNotes }),
    });
  }

  async adminMarkPaidManually(token: string, id: string, proofUrl?: string, adminNotes?: string) {
    return this.request(`/v1/admin/withdrawals/${id}/mark-paid`, {
      method: 'POST',
      token,
      body: JSON.stringify({ proofUrl, adminNotes }),
    });
  }

  async adminGetAuditLogs(token: string, params?: { page?: number; action?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.action) query.set('action', params.action);
    return this.request(`/v1/admin/audit-logs?${query}`, { token });
  }

  async adminGetTreasury(token: string) {
    return this.request('/v1/admin/treasury', { token });
  }

  async adminGetChains(token: string) {
    return this.request('/v1/admin/chains', { token });
  }

  async adminGetAssets(token: string) {
    return this.request('/v1/admin/assets', { token });
  }
}

export const api = new ApiClient(API_URL);
