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
info "Step 1/7: Install packages..."
pkg update -y && pkg upgrade -y
pkg install x11-repo -y
pkg install nodejs-lts mariadb chromium git nano tmux openssh -y
npm install -g pm2 pnpm
ok "Packages terinstall"

# ============================================
# STEP 2: SETUP SSH SERVER
# ============================================
info "Step 2/7: Setup SSH server..."

# Generate host keys kalau belum ada
if [ ! -f "$PREFIX/etc/ssh/ssh_host_rsa_key" ]; then
    ssh-keygen -A
    ok "SSH host keys generated"
fi

# Set SSH port ke 8022 (default Termux)
if ! grep -q "Port 8022" "$PREFIX/etc/ssh/sshd_config" 2>/dev/null; then
    echo "Port 8022" >> "$PREFIX/etc/ssh/sshd_config"
    ok "SSH port set to 8022"
fi

# Set password SSH kalau belum ada
if [ ! -f "$HOME/.ssh/authorized_keys" ] && ! ssh-keygen -l -f "$PREFIX/etc/ssh/ssh_host_rsa_key" &>/dev/null; then
    warn "Set password SSH untuk remote access:"
    warn "Jalankan: ${CYAN}passwd${NC}"
fi

ok "SSH server siap"

# ============================================
# STEP 3: SETUP & START MARIADB
# ============================================
info "Step 3/7: Setup MariaDB..."

# Init database kalau belum ada
if [ ! -d "/data/data/com.termux/files/usr/var/lib/mysql/mysql" ]; then
    mysql_install_db
    ok "MariaDB database initialized"
fi

# Start MariaDB kalau belum jalan
if ! pgrep -x mysqld > /dev/null 2>&1 && ! pgrep -x mariadbd > /dev/null 2>&1; then
    mysqld_safe &
    sleep 3
    # Tunggu MariaDB ready
    for i in {1..15}; do
        if mysqladmin ping -u root --silent 2>/dev/null; then
            break
        fi
        sleep 1
    done
fi

if mysqladmin ping -u root --silent 2>/dev/null; then
    ok "MariaDB running"
else
    err "MariaDB gagal start. Coba manual: mysqld_safe &"
    exit 1
fi

# ============================================
# STEP 4: BUAT DATABASE
# ============================================
info "Step 4/7: Buat database kflow_db..."
mysql -u root -e "CREATE DATABASE IF NOT EXISTS kflow_db;"
ok "Database kflow_db siap"

# ============================================
# STEP 5: SETUP .ENV
# ============================================
info "Step 5/7: Setup .env..."

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
# STEP 6: INSTALL NPM DEPENDENCIES
# ============================================
info "Step 6/7: pnpm install..."
pnpm install
ok "Dependencies terinstall"

# ============================================
# STEP 7: FINAL SETUP (TMUX + BASHRC)
# ============================================
info "Step 7/7: Final setup..."

# Pastikan folder temp ada
mkdir -p temp

# Setup .bashrc untuk auto-attach tmux
BASHRC="$HOME/.bashrc"
TMUX_MARKER="# === K-FLOW AUTO TMUX ==="

if ! grep -q "$TMUX_MARKER" "$BASHRC" 2>/dev/null; then
    cat >> "$BASHRC" << 'BASHRC_EOF'

# === K-FLOW AUTO TMUX + SSHD ===
if command -v tmux &>/dev/null; then
    # Auto-start SSH server
    if ! pgrep -x sshd > /dev/null 2>&1 && ! pgrep -x mariadbd > /dev/null 2>&1; then
        sshd 2>/dev/null
    fi

    # Auto-attach tmux session
    if [ -z "$TMUX" ]; then
        tmux attach -t bot 2>/dev/null || tmux new -s bot
    fi
fi
# === END K-FLOW AUTO TMUX + SSHD ===
BASHRC_EOF
    ok ".bashrc updated — auto-start sshd + auto-attach tmux"
else
    warn "tmux auto-attach sudah ada di .bashrc"
fi

chmod +x setup.sh 2>/dev/null || true
chmod +x start.sh 2>/dev/null || true

# ============================================
# SELESAI — TAMPILKAN INFO
# ============================================
# Ambil IP address
LOCAL_IP=$(ifconfig 2>/dev/null | grep -oE 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | awk '{print $2}' | head -1)
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="(gagal detect — jalankan 'ifconfig' manual)"
fi

ok "Setup selesai!"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}     SETUP SELESAI!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}1. Set password SSH:${NC}"
echo -e "   ${CYAN}passwd${NC}"
echo ""
echo -e "${YELLOW}2. Edit .env:${NC}"
echo -e "   ${CYAN}nano .env${NC}"
echo ""
echo -e "${YELLOW}3. Jalankan bot:${NC}"
echo -e "   ${CYAN}./start.sh${NC}"
echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}     REMOTE ACCESS DARI PC${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo -e "IP Termux: ${CYAN}$LOCAL_IP${NC}"
echo -e "SSH Port:  ${CYAN}8022${NC}"
echo ""
echo -e "Di PC, ketik:"
echo -e "  ${CYAN}ssh ${LOCAL_IP} -p 8022${NC}"
echo ""
echo -e "Setelah login, bot langsung jalan di tmux."
echo -e "Kalau mau sambung ke session yang sama:"
echo -e "  ${CYAN}tmux attach -t bot${NC}"
echo ""
echo -e "Atau buat script shortcut di PC (lihat README)."
echo ""
