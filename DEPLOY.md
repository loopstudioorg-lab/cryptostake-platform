# 🚀 Free Deployment Guide for CryptoStake

Deploy your CryptoStake platform for **$0/month** using these free services.

## 📋 Prerequisites

1. GitHub account (to host your code)
2. Accounts on free hosting services (links below)

---

## 🗄️ Step 1: Set Up Free Database (Neon PostgreSQL)

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Create a new project called `cryptostake`
3. Copy the connection string, it looks like:
   ```
   postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/cryptostake?sslmode=require
   ```
4. Save this as `DATABASE_URL`

---

## 🔴 Step 2: Set Up Free Redis (Upstash)

1. Go to [upstash.com](https://upstash.com) and sign up (free)
2. Create a new Redis database
3. Select the closest region to your API
4. Copy the Redis URL, it looks like:
   ```
   rediss://default:xxx@us1-xxx.upstash.io:6379
   ```
5. Save this as `REDIS_URL`

---

## ⚡ Step 3: Deploy API to Railway (Recommended)

### Option A: Railway (Easiest - $5 free credit/month)

1. Go to [railway.app](https://railway.app) and sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your CryptoStake repository
4. Set the root directory to `/` (monorepo root)
5. Add environment variables:
   ```
   DATABASE_URL=<from Neon>
   REDIS_URL=<from Upstash>
   JWT_ACCESS_SECRET=<generate with: openssl rand -hex 32>
   JWT_REFRESH_SECRET=<generate with: openssl rand -hex 32>
   MASTER_KEY=<generate with: openssl rand -hex 16>
   JWT_ACCESS_EXPIRES=15m
   JWT_REFRESH_EXPIRES=7d
   PORT=3001
   NODE_ENV=production
   CORS_ORIGINS=https://your-vercel-app.vercel.app
   ETH_RPC_URL=https://eth.llamarpc.com
   BSC_RPC_URL=https://bsc-dataseed.binance.org
   POLYGON_RPC_URL=https://polygon-rpc.com
   ```
6. Set build command:
   ```
   npm install -g pnpm && pnpm install && cd apps/api && npx prisma generate && pnpm build
   ```
7. Set start command:
   ```
   cd apps/api && npx prisma migrate deploy && node dist/main.js
   ```
8. Deploy! Note your API URL (e.g., `https://cryptostake-api.up.railway.app`)

### Option B: Render.com (Alternative)

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Blueprint"
3. Connect your GitHub repo
4. It will detect `render.yaml` and set up services
5. Add the missing environment variables manually

---

## 🌐 Step 4: Deploy Web App to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click "Add New Project"
3. Import your CryptoStake repository
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Build Command**: `cd ../.. && pnpm install && pnpm turbo build --filter=web`
   - **Output Directory**: `.next`
5. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-railway-api-url.up.railway.app
   ```
6. Deploy!

---

## 🔧 Step 5: Run Database Migrations & Seed

After deployment, run migrations via Railway CLI or dashboard:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run npx prisma migrate deploy

# Seed the database
railway run npx ts-node apps/api/prisma/seed.ts
```

Or through Railway dashboard:
1. Go to your service
2. Click "Settings" → "Deploy" → "Run Command"
3. Run: `cd apps/api && npx prisma migrate deploy && npx ts-node prisma/seed.ts`

---

## 📱 Step 6: Configure Mobile App

Update `apps/mobile/src/lib/api.ts`:

```typescript
const API_URL = 'https://your-railway-api-url.up.railway.app';
```

Then build with Expo:
```bash
cd apps/mobile
npx eas build --platform all
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Web app loads at your Vercel URL
- [ ] API responds at `https://your-api.railway.app/health`
- [ ] Can register a new user
- [ ] Can login and see dashboard
- [ ] Admin panel accessible at `/admin`
- [ ] Default admin login works: `admin@cryptostake.io` / `SuperAdmin123!`

---

## 🔒 Post-Deployment Security

⚠️ **IMPORTANT**: After confirming everything works:

1. **Change default passwords** for admin and demo users
2. **Enable 2FA** for admin accounts
3. **Update CORS_ORIGINS** to only allow your actual domains
4. **Set up monitoring** (Railway has built-in logs)

---

## 💰 Cost Summary

| Service | Free Tier Limits |
|---------|-----------------|
| Neon | 0.5 GB storage, 100 hours compute/month |
| Upstash | 10K commands/day, 256MB storage |
| Railway | $5 free credit/month (~500 hours) |
| Vercel | 100GB bandwidth, unlimited deployments |
| **Total** | **$0/month** for low traffic |

---

## 🐛 Troubleshooting

### API not starting
- Check Railway logs for errors
- Verify DATABASE_URL is correct
- Ensure Prisma migrations ran successfully

### CORS errors
- Update `CORS_ORIGINS` to include your Vercel URL
- Redeploy the API

### Database connection issues
- Neon databases sleep after 5 min of inactivity (free tier)
- First request may be slow (cold start)

### Redis connection issues
- Ensure using `rediss://` (with SSL) for Upstash
- Check Upstash dashboard for connection status

---

## 🔗 Quick Links

- [Neon Dashboard](https://console.neon.tech)
- [Upstash Dashboard](https://console.upstash.com)
- [Railway Dashboard](https://railway.app/dashboard)
- [Vercel Dashboard](https://vercel.com/dashboard)

---

## 📞 Need Help?

If you encounter issues:
1. Check the service-specific logs
2. Verify all environment variables are set
3. Ensure database migrations completed successfully
