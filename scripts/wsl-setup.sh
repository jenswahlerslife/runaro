#!/bin/bash
# WSL Ubuntu Development Environment Setup Script
# For Runaro Territory Game Project

set -e  # Exit on error

echo "🏃 Runaro WSL Development Setup"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running in WSL
if ! grep -qi microsoft /proc/version; then
  echo -e "${RED}❌ This script must be run inside WSL (Ubuntu)${NC}"
  echo "Please open VS Code and use: WSL: Open Folder in WSL"
  exit 1
fi

echo -e "${GREEN}✅ Running in WSL environment${NC}"
echo ""

# Update package lists
echo "📦 Updating package lists..."
sudo apt update

# Install essential build tools
echo "🔧 Installing essential build tools..."
sudo apt install -y \
  git \
  build-essential \
  curl \
  wget \
  ca-certificates \
  gnupg \
  lsb-release

# Install Node.js 18.x (LTS)
echo "📦 Installing Node.js 18.x..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt install -y nodejs
else
  echo -e "${YELLOW}Node.js already installed: $(node --version)${NC}"
fi

# Verify Node version
NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}❌ Node.js version must be >= 18.0.0 (found: $(node --version))${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
echo -e "${GREEN}✅ npm: $(npm --version)${NC}"

# Install Python 3 and pip (for some build tools)
echo "🐍 Installing Python 3..."
sudo apt install -y python3 python3-pip

# Install project dependencies
echo "📦 Installing project dependencies..."
if [ -f "package.json" ]; then
  npm ci
  echo -e "${GREEN}✅ Project dependencies installed${NC}"
else
  echo -e "${RED}❌ package.json not found. Are you in the project root?${NC}"
  exit 1
fi

# Set up Git (if not already configured)
echo "🔧 Checking Git configuration..."
if [ -z "$(git config --global user.name)" ]; then
  echo -e "${YELLOW}⚠️  Git user.name not set${NC}"
  echo "Run: git config --global user.name 'Your Name'"
fi
if [ -z "$(git config --global user.email)" ]; then
  echo -e "${YELLOW}⚠️  Git user.email not set${NC}"
  echo "Run: git config --global user.email 'your.email@example.com'"
fi

# Check for environment files
echo "🔍 Checking environment configuration..."
if [ ! -f ".env.local" ]; then
  if [ -f ".env.example" ]; then
    echo -e "${YELLOW}⚠️  .env.local not found. Copy from .env.example:${NC}"
    echo "cp .env.example .env.local"
  else
    echo -e "${YELLOW}⚠️  No .env.local or .env.example found${NC}"
  fi
fi

# Install Supabase CLI
echo "🔧 Installing Supabase CLI..."
if ! command -v supabase &> /dev/null; then
  npm install -g supabase
  echo -e "${GREEN}✅ Supabase CLI installed${NC}"
else
  echo -e "${YELLOW}Supabase CLI already installed: $(supabase --version)${NC}"
fi

# Install Cloudflare Wrangler CLI
echo "🔧 Installing Cloudflare Wrangler..."
if ! command -v wrangler &> /dev/null; then
  npm install -g wrangler
  echo -e "${GREEN}✅ Wrangler installed${NC}"
else
  echo -e "${YELLOW}Wrangler already installed: $(wrangler --version)${NC}"
fi

# Run type check
echo "🔍 Running TypeScript type check..."
if npm run type-check; then
  echo -e "${GREEN}✅ TypeScript types are valid${NC}"
else
  echo -e "${RED}❌ TypeScript type errors found${NC}"
  echo "Run: npm run type-check"
fi

# Summary
echo ""
echo "================================"
echo -e "${GREEN}✅ WSL Development Setup Complete!${NC}"
echo "================================"
echo ""
echo "Next steps:"
echo "  1. Configure .env.local with your API keys"
echo "  2. Run database setup: npm run db:setup"
echo "  3. Start development server: npm run dev"
echo "  4. Verify WSL: uname -a (should show microsoft-standard-WSL2)"
echo ""
echo "Available commands:"
echo "  npm run dev           - Start development server"
echo "  npm run build         - Production build"
echo "  npm test              - Run tests"
echo "  npm run lint          - Check code quality"
echo "  npm run db:push       - Deploy database migrations"
echo ""
echo "Happy coding! 🏃‍♂️"
