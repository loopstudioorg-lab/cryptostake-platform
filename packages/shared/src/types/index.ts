// User & Auth Types
export type Role = 'USER' | 'SUPPORT' | 'ADMIN' | 'SUPER_ADMIN';

export interface User {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  kycStatus: KycStatus;
  createdAt: string;
  updatedAt: string;
}

export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Session {
  id: string;
  userId: string;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Chain & Asset Types
export interface Chain {
  id: string;
  name: string;
  symbol: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  nativeAssetId: string;
  confirmationsRequired: number;
  isActive: boolean;
}

export interface Asset {
  id: string;
  chainId: string;
  name: string;
  symbol: string;
  decimals: number;
  contractAddress: string | null;
  isNative: boolean;
  iconUrl: string | null;
  isActive: boolean;
}

// Pool Types
export type PoolType = 'FLEXIBLE' | 'FIXED';

export interface Pool {
  id: string;
  name: string;
  description: string;
  assetId: string;
  asset?: Asset;
  type: PoolType;
  lockDays: number | null;
  currentApr: string;
  minStake: string;
  maxStake: string | null;
  totalCapacity: string | null;
  totalStaked: string;
  isActive: boolean;
  createdAt: string;
}

export interface AprSchedule {
  id: string;
  poolId: string;
  apr: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
}

// Stake Types
export type StakeStatus = 'ACTIVE' | 'UNSTAKING' | 'COMPLETED' | 'CANCELLED';

export interface StakePosition {
  id: string;
  userId: string;
  poolId: string;
  pool?: Pool;
  amount: string;
  rewardsAccrued: string;
  lastRewardCalculation: string;
  status: StakeStatus;
  lockedUntil: string | null;
  unstakedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Deposit Types
export type DepositStatus = 'AWAITING' | 'CONFIRMING' | 'CONFIRMED' | 'FAILED';

export interface DepositAddress {
  id: string;
  userId: string;
  chainId: string;
  address: string;
  derivationPath: string | null;
  createdAt: string;
}

export interface Deposit {
  id: string;
  userId: string;
  assetId: string;
  asset?: Asset;
  chainId: string;
  chain?: Chain;
  depositAddressId: string;
  txHash: string;
  logIndex: number | null;
  fromAddress: string;
  amount: string;
  confirmations: number;
  status: DepositStatus;
  confirmedAt: string | null;
  createdAt: string;
}

// Withdrawal Types
export type WithdrawalStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PROCESSING'
  | 'SENT'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'PAID_MANUALLY'
  | 'FAILED';

export interface WithdrawalRequest {
  id: string;
  userId: string;
  user?: User;
  assetId: string;
  asset?: Asset;
  chainId: string;
  chain?: Chain;
  amount: string;
  fee: string;
  netAmount: string;
  destinationAddress: string;
  status: WithdrawalStatus;
  userNotes: string | null;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  manualProofUrl: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutTx {
  id: string;
  withdrawalRequestId: string;
  txHash: string | null;
  nonce: number | null;
  gasPrice: string | null;
  gasLimit: string | null;
  gasUsed: string | null;
  status: 'PENDING' | 'SENT' | 'CONFIRMING' | 'CONFIRMED' | 'FAILED';
  confirmations: number;
  errorMessage: string | null;
  sentAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

// Ledger Types
export type LedgerEntryType =
  | 'DEPOSIT_CONFIRMED'
  | 'STAKE_CREATED'
  | 'STAKE_CANCELLED'
  | 'UNSTAKE_COMPLETED'
  | 'REWARD_ACCRUED'
  | 'REWARD_CLAIMED'
  | 'WITHDRAWAL_REQUESTED'
  | 'WITHDRAWAL_REJECTED'
  | 'WITHDRAWAL_PAID'
  | 'ADJUSTMENT';

export type LedgerDirection = 'CREDIT' | 'DEBIT';

export interface LedgerEntry {
  id: string;
  userId: string | null;
  assetId: string;
  chainId: string;
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amount: string;
  referenceType: string;
  referenceId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface BalanceCache {
  id: string;
  userId: string;
  assetId: string;
  chainId: string;
  available: string;
  staked: string;
  rewardsAccrued: string;
  withdrawalsPending: string;
  updatedAt: string;
}

// Treasury Types
export interface TreasuryWallet {
  id: string;
  chainId: string;
  address: string;
  label: string;
  isActive: boolean;
  createdAt: string;
}

// Audit Log Types
export interface AuditLog {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Dashboard Types
export interface UserDashboard {
  totalDeposited: string;
  availableBalance: string;
  stakedBalance: string;
  accruedRewards: string;
  pendingWithdrawals: string;
  balancesByAsset: BalanceCache[];
  activeStakes: StakePosition[];
  recentDeposits: Deposit[];
  recentWithdrawals: WithdrawalRequest[];
}

// Admin Types
export interface AdminDashboardStats {
  totalUsers: number;
  activeStakes: number;
  totalValueLocked: string;
  pendingWithdrawals: number;
  totalWithdrawalsPending: string;
  recentActivity: AuditLog[];
}

export interface WithdrawalQueueItem extends WithdrawalRequest {
  user: User;
  fraudIndicators: FraudIndicator[];
}

export interface FraudIndicator {
  type: 'NEW_ADDRESS' | 'HIGH_AMOUNT' | 'VELOCITY' | 'SUSPICIOUS_PATTERN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}
