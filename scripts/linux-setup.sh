#!/bin/bash
# Linux/WSL Development Setup Script for Runaro
# This script sets up the complete development environment

set -e  # Exit on error

echo "🚀 Runaro Development Environment Setup (Linux/WSL)"
echo "=================================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# Check if running in WSL
if grep -qi microsoft /proc/version; then
    print_info "Detected WSL environment"
    IS_WSL=true
else
    print_info "Detected native Linux environment"
    IS_WSL=false
fi

# Step 1: Check Node.js version
echo ""
print_info "Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_VERSION="18.0.0"

    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
        print_success "Node.js $NODE_VERSION installed (>= $REQUIRED_VERSION required)"
    else
        print_error "Node.js version $NODE_VERSION is too old (>= $REQUIRED_VERSION required)"
        echo "Please install a newer version of Node.js"
        exit 1
    fi
else
    print_error "Node.js is not installed"
    echo ""
    print_info "Installing Node.js via nvm (recommended)..."

    # Install nvm if not present
    if [ ! -d "$HOME/.nvm" ]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi

    # Install Node.js LTS
    nvm install --lts
    nvm use --lts
    print_success "Node.js installed successfully"
fi

# Step 2: Check npm version
echo ""
print_info "Checking npm installation..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm $NPM_VERSION installed"
else
    print_error "npm is not installed"
    exit 1
fi

# Step 3: Install dependencies
echo ""
print_info "Installing project dependencies..."
if npm ci; then
    print_success "Dependencies installed successfully"
else
    print_warning "npm ci failed, trying npm install..."
    npm install
    print_success "Dependencies installed via npm install"
fi

# Step 4: Check for .env.local file
echo ""
print_info "Checking environment configuration..."
if [ -f ".env.local" ]; then
    print_success ".env.local file found"
else
    print_warning ".env.local file not found"

    if [ -f ".env.example" ]; then
        print_info "Creating .env.local from .env.example..."
        cp .env.example .env.local
        print_warning "Please edit .env.local and add your API keys"
    else
        print_error ".env.example not found. Please create .env.local manually"
    fi
fi

# Step 5: Check Supabase CLI
echo ""
print_info "Checking Supabase CLI..."
if command -v supabase &> /dev/null; then
    SUPABASE_VERSION=$(supabase --version)
    print_success "Supabase CLI installed: $SUPABASE_VERSION"
else
    print_warning "Supabase CLI not found"
    print_info "Installing Supabase CLI..."

    if [ "$IS_WSL" = true ]; then
        # For WSL, use npm installation
        npm install -g supabase
    else
        # For native Linux, use official method
        curl -L https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz -o supabase.tar.gz
        tar -xzf supabase.tar.gz
        sudo mv supabase /usr/local/bin/
        rm supabase.tar.gz
    fi

    print_success "Supabase CLI installed"
fi

# Step 6: Setup Supabase connection
echo ""
print_info "Setting up Supabase connection..."
if [ -f ".env.local" ]; then
    if grep -q "SUPABASE_ACCESS_TOKEN" .env.local && grep -q "SUPABASE_PROJECT_REF" .env.local; then
        print_info "Running Supabase setup..."
        if npm run db:setup 2>/dev/null; then
            print_success "Supabase connected successfully"
        else
            print_warning "Supabase setup failed - you may need to run 'npm run db:setup' manually"
        fi
    else
        print_warning "Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF in .env.local"
        print_info "Please add these values before running 'npm run db:setup'"
    fi
else
    print_warning "Skipping Supabase setup - .env.local not configured"
fi

# Step 7: Run type check
echo ""
print_info "Running TypeScript type check..."
if npm run type-check; then
    print_success "No type errors found"
else
    print_warning "Type check failed - please review the errors above"
fi

# Step 8: Summary and next steps
echo ""
echo "=================================================="
print_success "Setup Complete!"
echo "=================================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Review and update .env.local with your API keys"
echo "2. Start the development server:"
echo "   $ npm run dev"
echo ""
echo "3. Run tests:"
echo "   $ npm test"
echo ""
echo "4. Build for production:"
echo "   $ npm run build"
echo ""
echo "📚 Useful Commands:"
echo "   npm run lint          - Run ESLint"
echo "   npm run type-check    - Check TypeScript types"
echo "   npm run db:status     - Check database migrations"
echo "   npm run db:push       - Deploy database migrations"
echo ""
print_success "Happy coding! 🎉"
