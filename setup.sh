#!/bin/bash

# ============================================
# K-Flow Termux Setup Script
# ============================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }

# ============================================
# CEK ENVIRONMENT
# ============================================
if [ ! -d "/data/data/com.termux" ]; then
    err "Script ini khusus Termux!"
    exit 1
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}     K-Flow Termux Auto Setup${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ============================================
# STEP 1: UPDATE & INSTALL PACKAGES
# ============================================
info "Step 1/6: Install packages..."
pkg update -y && pkg upgrade -y
pkg install nodejs-lts mysql chromium git nano -y
ok "Packages terinstall"

# ============================================
# STEP 2: SETUP & START MYSQL
# ============================================
info "Step 2/6: Setup MySQL..."

# Init database kalau belum ada
if [ ! -d "/data/data/com.termux/files/usr/var/lib/mysql/mysql" ]; then
    mysql_install_db
    ok "MySQL database initialized"
fi

# Start MySQL kalau belum jalan
if ! pgrep -x mysqld > /dev/null 2>&1; then
    mysqld_safe &
    sleep 3
    # Tunggu MySQL ready
    for i in {1..15}; do
        if mysqladmin ping -u root --silent 2>/dev/null; then
            break
        fi
        sleep 1
    done
fi

if mysqladmin ping -u root --silent 2>/dev/null; then
    ok "MySQL running"
else
    err "MySQL gagal start. Coba manual: mysqld_safe &"
    exit 1
fi

# ============================================
# STEP 3: BUAT DATABASE
# ============================================
info "Step 3/6: Buat database kflow_db..."
mysql -u root -e "CREATE DATABASE IF NOT EXISTS kflow_db;"
ok "Database kflow_db siap"

# ============================================
# STEP 4: SETUP .ENV
# ============================================
info "Step 4/6: Setup .env..."

if [ ! -f ".env" ]; then
    cp .env.example .env
    ok ".env dibuat dari .env.example"
else
    warn ".env sudah ada, skip"
fi

# Detect chromium path
CHROMIUM_PATH=""
if [ -f "/data/data/com.termux/files/usr/bin/chromium-browser" ]; then
    CHROMIUM_PATH="/data/data/com.termux/files/usr/bin/chromium-browser"
elif [ -f "/data/data/com.termux/usr/bin/chromium-browser" ]; then
    CHROMIUM_PATH="/data/data/com.termux/usr/bin/chromium-browser"
fi

# Update PUPPETEER_EXECUTABLE_PATH in .env
if [ -n "$CHROMIUM_PATH" ]; then
    sed -i "s|^PUPPETEER_EXECUTABLE_PATH=.*|PUPPETEER_EXECUTABLE_PATH=$CHROMIUM_PATH|" .env
    ok "Puppeteer path: $CHROMIUM_PATH"
fi

# ============================================
# STEP 5: INSTALL NPM DEPENDENCIES
# ============================================
info "Step 5/6: npm install..."
npm install
ok "Dependencies terinstall"

# ============================================
# STEP 6: FINAL SETUP
# ============================================
info "Step 6/6: Final setup..."

# Pastikan folder temp ada
mkdir -p temp

# Set executable
chmod +x setup.sh 2>/dev/null || true

ok "Setup selesai!"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}     SETUP SELESAI!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Yang perlu kamu lakukan:${NC}"
echo ""
echo -e "  1. Edit .env sesuai nomor kamu:"
echo -e "     ${CYAN}nano .env${NC}"
echo ""
echo -e "  2. Isi minimal:"
echo -e "     - BOT_NAME"
echo -e "     - BOT_OWNER_NUMBERS"
echo -e "     - BOT_USERS"
echo -e "     - LOG_NUMBER"
echo -e "     - GEMINI_API_KEY (optional)"
echo ""
echo -e "  3. Jalankan bot:"
echo -e "     ${CYAN}npm run start${NC}"
echo ""
echo -e "  4. Scan QR code dari WhatsApp"
echo ""
echo -e "${YELLOW}Setiap buka Termux baru:${NC}"
echo -e "  ${CYAN}mysqld_safe &${NC}  (start MySQL dulu)"
echo -e "  ${CYAN}cd ~/k-flow && npm run start${NC}"
echo ""
echo -e "${YELLOW}Dashboard:${NC} http://localhost:3000"
echo ""
