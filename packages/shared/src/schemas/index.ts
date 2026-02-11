import { z } from 'zod';

// Auth Schemas
export const emailSchema = z.string().email('Invalid email address');
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().length(6).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const enable2faSchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits'),
});

export const verify2faSchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits'),
});

// Profile Schemas
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
  notificationsEnabled: z.boolean().optional(),
});

// Staking Schemas
export const createStakeSchema = z.object({
  poolId: z.string().uuid('Invalid pool ID'),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format'),
});

export const unstakeSchema = z.object({
  stakePositionId: z.string().uuid('Invalid stake position ID'),
});

export const claimRewardsSchema = z.object({
  stakePositionId: z.string().uuid('Invalid stake position ID'),
});

// Withdrawal Schemas
export const ethereumAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

export const createWithdrawalRequestSchema = z.object({
  assetId: z.string().uuid('Invalid asset ID'),
  chainId: z.string().uuid('Invalid chain ID'),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format'),
  destinationAddress: ethereumAddressSchema,
  userNotes: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid('Invalid idempotency key'),
});

// Admin Schemas
export const createPoolSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  assetId: z.string().uuid(),
  type: z.enum(['FLEXIBLE', 'FIXED']),
  lockDays: z.number().int().min(0).max(365).nullable(),
  initialApr: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid APR format'),
  minStake: z.string().regex(/^\d+(\.\d+)?$/),
  maxStake: z.string().regex(/^\d+(\.\d+)?$/).nullable(),
  totalCapacity: z.string().regex(/^\d+(\.\d+)?$/).nullable(),
  isActive: z.boolean().default(true),
});

export const updatePoolSchema = createPoolSchema.partial().extend({
  id: z.string().uuid(),
});

export const updateAprSchema = z.object({
  poolId: z.string().uuid(),
  newApr: z.string().regex(/^\d+(\.\d+)?$/),
  effectiveFrom: z.string().datetime(),
});

export const reviewWithdrawalSchema = z.object({
  withdrawalRequestId: z.string().uuid(),
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_INFO']),
  adminNotes: z.string().max(1000).optional(),
});

export const markPaidManuallySchema = z.object({
  withdrawalRequestId: z.string().uuid(),
  proofUrl: z.string().url().optional(),
  adminNotes: z.string().max(1000),
});

export const createTreasuryWalletSchema = z.object({
  chainId: z.string().uuid(),
  address: ethereumAddressSchema,
  label: z.string().min(1).max(100),
});

export const createChainSchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(10),
  chainId: z.number().int().positive(),
  rpcUrl: z.string().url(),
  explorerUrl: z.string().url(),
  confirmationsRequired: z.number().int().min(1).max(100),
  isActive: z.boolean().default(true),
});

export const createAssetSchema = z.object({
  chainId: z.string().uuid(),
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(10),
  decimals: z.number().int().min(0).max(18),
  contractAddress: ethereumAddressSchema.nullable(),
  isNative: z.boolean(),
  iconUrl: z.string().url().nullable(),
  isActive: z.boolean().default(true),
});

// Pagination & Filter Schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const auditLogFilterSchema = paginationSchema.extend({
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const withdrawalQueueFilterSchema = paginationSchema.extend({
  status: z.enum([
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'PROCESSING',
    'SENT',
    'CONFIRMING',
    'CONFIRMED',
    'COMPLETED',
    'PAID_MANUALLY',
    'FAILED',
  ]).optional(),
  userId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
});

// Type exports from schemas
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type Enable2faInput = z.infer<typeof enable2faSchema>;
export type Verify2faInput = z.infer<typeof verify2faSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateStakeInput = z.infer<typeof createStakeSchema>;
export type UnstakeInput = z.infer<typeof unstakeSchema>;
export type ClaimRewardsInput = z.infer<typeof claimRewardsSchema>;
export type CreateWithdrawalRequestInput = z.infer<typeof createWithdrawalRequestSchema>;
export type CreatePoolInput = z.infer<typeof createPoolSchema>;
export type UpdatePoolInput = z.infer<typeof updatePoolSchema>;
export type UpdateAprInput = z.infer<typeof updateAprSchema>;
export type ReviewWithdrawalInput = z.infer<typeof reviewWithdrawalSchema>;
export type MarkPaidManuallyInput = z.infer<typeof markPaidManuallySchema>;
export type CreateTreasuryWalletInput = z.infer<typeof createTreasuryWalletSchema>;
export type CreateChainInput = z.infer<typeof createChainSchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type AuditLogFilterInput = z.infer<typeof auditLogFilterSchema>;
export type WithdrawalQueueFilterInput = z.infer<typeof withdrawalQueueFilterSchema>;
