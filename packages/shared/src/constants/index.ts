// Withdrawal Status Flow
export const WITHDRAWAL_STATUS_FLOW = {
  PENDING_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['PROCESSING', 'PAID_MANUALLY'],
  REJECTED: [],
  PROCESSING: ['SENT', 'FAILED'],
  SENT: ['CONFIRMING', 'FAILED'],
  CONFIRMING: ['CONFIRMED', 'FAILED'],
  CONFIRMED: ['COMPLETED'],
  COMPLETED: [],
  PAID_MANUALLY: [],
  FAILED: ['PROCESSING', 'PAID_MANUALLY'],
} as const;

// Deposit Status
export const DEPOSIT_STATUS = {
  AWAITING: 'AWAITING',
  CONFIRMING: 'CONFIRMING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
} as const;

// Stake Status
export const STAKE_STATUS = {
  ACTIVE: 'ACTIVE',
  UNSTAKING: 'UNSTAKING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

// Pool Types
export const POOL_TYPE = {
  FLEXIBLE: 'FLEXIBLE',
  FIXED: 'FIXED',
} as const;

// Lock Period Options (days)
export const LOCK_PERIOD_OPTIONS = [0, 7, 30, 90, 180, 365] as const;

// KYC Status
export const KYC_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

// User Roles
export const USER_ROLES = {
  USER: 'USER',
  SUPPORT: 'SUPPORT',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

// Role Hierarchy (higher index = more permissions)
export const ROLE_HIERARCHY = ['USER', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN'] as const;

// Ledger Entry Types
export const LEDGER_ENTRY_TYPES = {
  DEPOSIT_CONFIRMED: 'DEPOSIT_CONFIRMED',
  STAKE_CREATED: 'STAKE_CREATED',
  STAKE_CANCELLED: 'STAKE_CANCELLED',
  UNSTAKE_COMPLETED: 'UNSTAKE_COMPLETED',
  REWARD_ACCRUED: 'REWARD_ACCRUED',
  REWARD_CLAIMED: 'REWARD_CLAIMED',
  WITHDRAWAL_REQUESTED: 'WITHDRAWAL_REQUESTED',
  WITHDRAWAL_REJECTED: 'WITHDRAWAL_REJECTED',
  WITHDRAWAL_PAID: 'WITHDRAWAL_PAID',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

// Ledger Directions
export const LEDGER_DIRECTION = {
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
} as const;

// Fraud Indicator Types
export const FRAUD_INDICATOR_TYPES = {
  NEW_ADDRESS: 'NEW_ADDRESS',
  HIGH_AMOUNT: 'HIGH_AMOUNT',
  VELOCITY: 'VELOCITY',
  SUSPICIOUS_PATTERN: 'SUSPICIOUS_PATTERN',
} as const;

// Security Thresholds
export const SECURITY_THRESHOLDS = {
  NEW_ADDRESS_COOLDOWN_HOURS: 24,
  DAILY_WITHDRAWAL_LIMIT_USD: 10000,
  LARGE_WITHDRAWAL_THRESHOLD_USD: 5000,
  MAX_DAILY_WITHDRAWAL_REQUESTS: 5,
  SESSION_EXPIRY_DAYS: 30,
  REFRESH_TOKEN_EXPIRY_DAYS: 7,
  ACCESS_TOKEN_EXPIRY_MINUTES: 15,
  PASSWORD_RESET_EXPIRY_HOURS: 1,
  EMAIL_VERIFICATION_EXPIRY_HOURS: 24,
  RATE_LIMIT_AUTH_ATTEMPTS: 5,
  RATE_LIMIT_WINDOW_MINUTES: 15,
} as const;

// Default Confirmations per Chain
export const DEFAULT_CONFIRMATIONS = {
  ethereum: 12,
  bsc: 15,
  polygon: 128,
  arbitrum: 12,
  optimism: 12,
  avalanche: 12,
} as const;

// API Endpoints (for mobile/web clients)
export const API_ENDPOINTS = {
  // Auth
  REGISTER: '/v1/auth/register',
  LOGIN: '/v1/auth/login',
  REFRESH: '/v1/auth/refresh',
  LOGOUT: '/v1/auth/logout',
  FORGOT_PASSWORD: '/v1/auth/forgot-password',
  RESET_PASSWORD: '/v1/auth/reset-password',
  
  // 2FA
  ENABLE_2FA: '/v1/auth/2fa/enable',
  VERIFY_2FA: '/v1/auth/2fa/verify',
  DISABLE_2FA: '/v1/auth/2fa/disable',
  
  // User
  PROFILE: '/v1/user/profile',
  SESSIONS: '/v1/user/sessions',
  BALANCES: '/v1/user/balances',
  DASHBOARD: '/v1/user/dashboard',
  
  // Pools
  POOLS: '/v1/pools',
  POOL_DETAIL: '/v1/pools/:id',
  
  // Stakes
  STAKES: '/v1/stakes',
  CREATE_STAKE: '/v1/stakes',
  UNSTAKE: '/v1/stakes/:id/unstake',
  CLAIM_REWARDS: '/v1/stakes/:id/claim',
  
  // Deposits
  DEPOSIT_ADDRESS: '/v1/deposits/address',
  DEPOSITS: '/v1/deposits',
  
  // Withdrawals
  WITHDRAWALS: '/v1/withdrawals',
  CREATE_WITHDRAWAL: '/v1/withdrawals',
  WITHDRAWAL_DETAIL: '/v1/withdrawals/:id',
  
  // Admin
  ADMIN_DASHBOARD: '/v1/admin/dashboard',
  ADMIN_USERS: '/v1/admin/users',
  ADMIN_POOLS: '/v1/admin/pools',
  ADMIN_WITHDRAWALS: '/v1/admin/withdrawals',
  ADMIN_TREASURY: '/v1/admin/treasury',
  ADMIN_AUDIT_LOGS: '/v1/admin/audit-logs',
} as const;

// Queue Names
export const QUEUE_NAMES = {
  DEPOSIT_MONITOR: 'deposit-monitor',
  PAYOUT_PROCESSOR: 'payout-processor',
  REWARD_CALCULATOR: 'reward-calculator',
  NOTIFICATION: 'notification',
} as const;

// Job Types
export const JOB_TYPES = {
  // Deposit Monitor
  SCAN_DEPOSITS: 'scan-deposits',
  CONFIRM_DEPOSIT: 'confirm-deposit',
  
  // Payout Processor
  PROCESS_PAYOUT: 'process-payout',
  CHECK_PAYOUT_STATUS: 'check-payout-status',
  
  // Reward Calculator
  CALCULATE_REWARDS: 'calculate-rewards',
  
  // Notifications
  SEND_EMAIL: 'send-email',
  SEND_PUSH: 'send-push',
} as const;

// UI Copy
export const UI_COPY = {
  WITHDRAWAL_DISCLAIMER: 'Withdrawals require admin review. Processing time may vary. This is not an instant withdrawal.',
  DEPOSIT_INSTRUCTION: 'Send only the specified token to this address. Sending other tokens may result in permanent loss.',
  STAKING_RISK: 'Staking involves risk. Past performance does not guarantee future results. Please read our risk disclosure.',
  CUSTODIAL_NOTICE: 'This is a custodial platform. Your assets are held in platform-controlled wallets.',
} as const;

// Deep Link Schemes
export const DEEP_LINK_SCHEMES = {
  APP: 'stakingapp',
  WEB: 'https://stake.example.com',
} as const;

// Supported Chains (MVP)
export const SUPPORTED_CHAINS = ['ethereum', 'bsc', 'polygon'] as const;
