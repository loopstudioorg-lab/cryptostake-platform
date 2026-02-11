# CryptoStake - Custodial Crypto Staking Platform

A production-grade custodial crypto staking platform with web and mobile applications. Users deposit crypto to platform-controlled addresses, stake internally, and request withdrawals that require admin approval.

![Platform Architecture](https://img.shields.io/badge/Architecture-Monorepo-blue)
![Next.js](https://img.shields.io/badge/Web-Next.js%2015-black)
![React Native](https://img.shields.io/badge/Mobile-Expo%20SDK%2052-blue)
![NestJS](https://img.shields.io/badge/Backend-NestJS-red)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue)
![Redis](https://img.shields.io/badge/Queue-BullMQ%20%2B%20Redis-red)

## ⚠️ Security Notice

**This is a custodial platform handling cryptocurrency. Before deploying to production:**

1. **Treasury Keys**: Never store private keys in environment variables in production. Use HSM, AWS KMS, or similar.
2. **Encryption**: Generate strong `MASTER_KEY` (32+ characters) for AES-256-GCM encryption.
3. **2FA**: Super admin must enable 2FA immediately after first login.
4. **Audit**: Have the codebase audited by security professionals.
5. **Insurance**: Consider custody insurance for user funds.
6. **Compliance**: Ensure compliance with local regulations (KYC/AML).

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                    │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│   Web App       │   Mobile App    │   Admin Panel                   │
│   (Next.js)     │   (Expo RN)     │   (Next.js /admin)              │
└────────┬────────┴────────┬────────┴────────┬────────────────────────┘
         │                 │                 │
         └────────────────┬┴─────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │          REST API (NestJS)         │
         │  - JWT Auth + Refresh Rotation     │
         │  - RBAC (USER/SUPPORT/ADMIN)       │
         │  - Rate Limiting                   │
         │  - Input Validation                │
         └───────────────┬────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌─────────────────────┐     ┌─────────────────────┐
│    PostgreSQL       │     │       Redis         │
│  - Users & Auth     │     │  - Job Queues       │
│  - Ledger System    │     │  - Rate Limit       │
│  - Audit Logs       │     │  - Sessions Cache   │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                            ┌──────────┴──────────┐
                            ▼                     ▼
                   ┌─────────────────┐   ┌─────────────────┐
                   │ Deposit Monitor │   │ Payout Processor│
                   │    (Worker)     │   │    (Worker)     │
                   └────────┬────────┘   └────────┬────────┘
                            │                     │
                            └──────────┬──────────┘
                                       ▼
                         ┌─────────────────────────┐
                         │     Blockchain RPCs     │
                         │  ETH / BSC / Polygon    │
                         └─────────────────────────┘
```

## 📁 Monorepo Structure

```
/
├── apps/
│   ├── api/              # NestJS Backend API
│   │   ├── prisma/       # Database schema & migrations
│   │   └── src/
│   │       └── modules/  # Auth, Users, Pools, Stakes, etc.
│   ├── web/              # Next.js Web Application
│   │   └── src/
│   │       ├── app/      # App Router pages
│   │       ├── components/
│   │       └── lib/
│   ├── mobile/           # Expo React Native App
│   │   ├── app/          # Expo Router screens
│   │   └── src/
│   └── workers/          # BullMQ Background Workers
│       └── src/
│           └── processors/
├── packages/
│   ├── shared/           # Shared types, schemas, constants
│   ├── config/           # Shared configs (TS, Tailwind, ESLint)
│   └── ui/               # Shared UI tokens
├── docker-compose.yml
├── turbo.json
└── package.json
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### 1. Clone & Install

```bash
git clone <repo-url>
cd crypto-stake

# Install dependencies
pnpm install
```

### 2. Environment Setup

```bash
# Copy example env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/workers/.env.example apps/workers/.env

# Edit with your values
nano apps/api/.env
```

### 3. Start Dependencies

```bash
# Start PostgreSQL & Redis
docker compose up -d postgres redis
```

### 4. Initialize Database

```bash
# Navigate to API
cd apps/api

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database with demo data
npx prisma db seed
```

### 5. Run Development Servers

```bash
# From root directory
pnpm dev
```

Or run individually:

```bash
# Terminal 1: API
cd apps/api && pnpm dev

# Terminal 2: Workers
cd apps/workers && pnpm dev

# Terminal 3: Web
cd apps/web && pnpm dev

# Terminal 4: Mobile
cd apps/mobile && pnpm start
```

### 6. Access Applications

| Application | URL |
|-------------|-----|
| Web App | http://localhost:3000 |
| Admin Panel | http://localhost:3000/admin |
| API | http://localhost:3001 |
| API Docs | http://localhost:3001/docs |
| Mobile | Expo Go app on your device |

### Default Credentials

**Super Admin:**
- Email: `admin@cryptostake.io`
- Password: `SuperAdmin123!`
- ⚠️ Enable 2FA after first login!

**Demo User:**
- Email: `demo@cryptostake.io`
- Password: `DemoUser123!`

## ⚙️ Environment Variables

### API (`apps/api/.env`)

```env
# Database
DATABASE_URL="postgresql://cryptostake:cryptostake_dev_password@localhost:5432/cryptostake"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Configuration
JWT_ACCESS_SECRET="your-access-secret-min-32-characters"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-characters"
JWT_REFRESH_EXPIRES="7d"

# Encryption (for sensitive data like 2FA secrets, treasury keys)
MASTER_KEY="your-master-encryption-key-32ch!"

# Server
PORT=3001
CORS_ORIGINS="http://localhost:3000,http://localhost:19006"

# Blockchain RPCs
ETH_RPC_URL="https://eth.llamarpc.com"
BSC_RPC_URL="https://bsc-dataseed.binance.org"
POLYGON_RPC_URL="https://polygon-rpc.com"

# Confirmations required per chain
ETH_CONFIRMATIONS=12
BSC_CONFIRMATIONS=15
POLYGON_CONFIRMATIONS=128

# Treasury (for production, use HSM/KMS)
# TREASURY_PRIVATE_KEY_ETH="encrypted:..."
# TREASURY_PRIVATE_KEY_BSC="encrypted:..."
# TREASURY_PRIVATE_KEY_POLYGON="encrypted:..."

# Email (optional for dev)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=user
# SMTP_PASS=pass
# EMAIL_FROM=noreply@cryptostake.io
```

### Web (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### Workers (`apps/workers/.env`)

```env
DATABASE_URL="postgresql://cryptostake:cryptostake_dev_password@localhost:5432/cryptostake"
REDIS_URL="redis://localhost:6379"
MASTER_KEY="your-master-encryption-key-32ch!"

# Blockchain RPCs
ETH_RPC_URL="https://eth.llamarpc.com"
BSC_RPC_URL="https://bsc-dataseed.binance.org"
POLYGON_RPC_URL="https://polygon-rpc.com"

# Confirmations
ETH_CONFIRMATIONS=12
BSC_CONFIRMATIONS=15
POLYGON_CONFIRMATIONS=128
```

## 🔐 Security Features

### Authentication
- Argon2id password hashing
- JWT access tokens (15min) + refresh tokens (7 days)
- Refresh token rotation
- Device session management
- Admin 2FA with TOTP + recovery codes

### Authorization
- Role-based access control (RBAC)
- Roles: USER, SUPPORT, ADMIN, SUPER_ADMIN
- Route guards & decorators

### Data Protection
- AES-256-GCM encryption for sensitive fields
- Encrypted 2FA secrets
- Encrypted treasury keys (if stored in DB)

### Rate Limiting
- Authentication endpoints: 5 req/min
- Withdrawal requests: 3 req/min
- API general: 100 req/min

### Fraud Prevention
- New withdrawal address 24h cooldown
- Daily withdrawal limits
- Large withdrawal flagging
- Velocity checks

### Audit Logging
- All admin actions logged
- Before/after state diffs
- IP & user agent tracking

## 📊 Ledger System

All balance movements go through the ledger system. Never update balances directly.

### Entry Types
- `DEPOSIT_CONFIRMED` - Deposit credited after confirmations
- `STAKE_CREATED` - Amount moved to staked
- `UNSTAKE_COMPLETED` - Amount returned to available
- `REWARD_ACCRUED` - Staking rewards calculated
- `REWARD_CLAIMED` - Rewards moved to available
- `WITHDRAWAL_REQUESTED` - Amount reserved for withdrawal
- `WITHDRAWAL_REJECTED` - Reserved amount released
- `WITHDRAWAL_PAID` - Payout executed
- `ADJUSTMENT` - Manual admin adjustment (audited)

### Balance Reconciliation

Run reconciliation to verify cached balances match ledger:

```bash
cd apps/api
npx ts-node scripts/reconcile-balances.ts
```

## 🔄 Withdrawal Flow

```
User                  API                    Admin              Worker           Blockchain
  │                    │                       │                   │                  │
  │─── Submit Request ─▶│                       │                   │                  │
  │                    │─── Create Request ────▶│                   │                  │
  │                    │    (PENDING_REVIEW)    │                   │                  │
  │                    │                       │                   │                  │
  │                    │◀─── Review Request ───│                   │                  │
  │                    │     Approve/Reject    │                   │                  │
  │                    │                       │                   │                  │
  │                    │──── If Approved ──────▶│─── Queue Job ───▶│                  │
  │                    │     (APPROVED)        │                   │                  │
  │                    │                       │                   │─── Build Tx ────▶│
  │                    │                       │                   │◀── Broadcast ────│
  │                    │                       │                   │    (SENT)        │
  │                    │                       │                   │◀── Confirmations─│
  │                    │                       │                   │    (CONFIRMED)   │
  │◀── Status Updated ─│◀── Update Status ─────│◀── Complete ──────│                  │
  │                    │    (COMPLETED)        │                   │                  │
```

### Manual Payouts

Admins can mark withdrawals as `PAID_MANUALLY` with:
- Proof URL (e.g., block explorer link)
- Transaction hash
- Notes

## 🔧 API Endpoints

### Public
- `GET /v1/pools` - List active pools
- `GET /v1/pools/:slug` - Pool details

### Authentication
- `POST /v1/auth/register` - Register new user
- `POST /v1/auth/login` - Login (returns tokens)
- `POST /v1/auth/refresh` - Refresh access token
- `POST /v1/auth/logout` - Logout (revoke refresh token)
- `GET /v1/auth/sessions` - List active sessions
- `DELETE /v1/auth/sessions/:id` - Revoke session

### User
- `GET /v1/user/profile` - Get profile
- `PATCH /v1/user/profile` - Update profile
- `GET /v1/user/balances` - Get all balances

### Stakes
- `GET /v1/stakes` - List user stakes
- `POST /v1/stakes` - Create stake
- `POST /v1/stakes/:id/unstake` - Unstake
- `POST /v1/stakes/:id/claim` - Claim rewards

### Deposits
- `GET /v1/deposits` - List user deposits
- `GET /v1/deposits/address/:chainId` - Get deposit address

### Withdrawals
- `GET /v1/withdrawals` - List user withdrawals
- `POST /v1/withdrawals` - Submit withdrawal request
- `GET /v1/withdrawals/:id` - Get withdrawal details

### Admin (requires ADMIN/SUPER_ADMIN role + 2FA)
- `GET /v1/admin/users` - List users
- `GET /v1/admin/users/:id` - User details
- `GET /v1/admin/withdrawals` - Withdrawal queue
- `POST /v1/admin/withdrawals/:id/approve` - Approve withdrawal
- `POST /v1/admin/withdrawals/:id/reject` - Reject withdrawal
- `POST /v1/admin/withdrawals/:id/mark-paid` - Mark as manually paid
- `GET /v1/admin/pools` - List all pools
- `POST /v1/admin/pools` - Create pool
- `PATCH /v1/admin/pools/:id` - Update pool
- `GET /v1/admin/audit-logs` - View audit logs

## 🐳 Docker Production Deployment

### Build Images

```bash
docker compose build
```

### Run Production Stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Environment for Production

```env
NODE_ENV=production

# Use strong secrets (generate with: openssl rand -hex 32)
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
MASTER_KEY="..."

# Use proper RPC endpoints (Infura, Alchemy, etc.)
ETH_RPC_URL="https://mainnet.infura.io/v3/YOUR_KEY"

# Configure proper CORS
CORS_ORIGINS="https://yourdomain.com"
```

## 📱 Mobile App

### Development

```bash
cd apps/mobile
pnpm start
```

Scan QR code with Expo Go app.

### Building

```bash
# iOS
npx eas build --platform ios

# Android  
npx eas build --platform android
```

## 🧪 Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:cov
```

## 📝 Development Scripts

```bash
# Start all development servers
pnpm dev

# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Type check
pnpm typecheck

# Database operations
cd apps/api
npx prisma migrate dev      # Run migrations
npx prisma db seed          # Seed database
npx prisma studio           # Open Prisma Studio GUI
npx prisma generate         # Regenerate client
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**⚠️ DISCLAIMER**: This software is provided as-is for educational purposes. Operating a custodial cryptocurrency platform involves significant legal, regulatory, and security responsibilities. Ensure compliance with all applicable laws and regulations before deploying.
