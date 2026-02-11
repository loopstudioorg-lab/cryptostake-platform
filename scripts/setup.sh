#!/bin/bash

# CryptoStake Setup Script
# This script helps you set up the development environment

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CryptoStake Development Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ is required. Current version: $(node -v)"
    exit 1
fi
echo "   ✓ Node.js $(node -v)"

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Install with: npm install -g pnpm"
    exit 1
fi
echo "   ✓ pnpm $(pnpm -v)"

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop"
    exit 1
fi
echo "   ✓ Docker $(docker -v | cut -d' ' -f3 | tr -d ',')"

echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🐳 Starting PostgreSQL and Redis..."
docker compose up -d postgres redis

echo ""
echo "⏳ Waiting for databases to be ready..."
sleep 5

echo ""
echo "📊 Setting up database..."
cd apps/api
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
cd ../..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Start development servers:"
echo "    pnpm dev"
echo ""
echo "  Or start services individually:"
echo "    cd apps/api && pnpm dev      # API server"
echo "    cd apps/workers && pnpm dev  # Background workers"
echo "    cd apps/web && pnpm dev      # Web app"
echo "    cd apps/mobile && pnpm start # Mobile app"
echo ""
echo "  Access:"
echo "    Web App:     http://localhost:3000"
echo "    Admin Panel: http://localhost:3000/admin"
echo "    API:         http://localhost:3001"
echo "    API Docs:    http://localhost:3001/docs"
echo ""
echo "  Default Credentials:"
echo "    Admin: admin@cryptostake.io / SuperAdmin123!"
echo "    User:  demo@cryptostake.io / DemoUser123!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
