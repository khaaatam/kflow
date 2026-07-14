#!/bin/bash

# ============================================
# K-Flow Start Script (Termux)
# Jalankan ini setiap kali buka Termux
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cd "$(dirname "$0")"

echo -e "${CYAN}Starting K-Flow...${NC}"

# Start MySQL kalau belum jalan
if ! pgrep -x mysqld > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting MySQL...${NC}"
    mysqld_safe &
    sleep 3
    for i in {1..15}; do
        if mysqladmin ping -u root --silent 2>/dev/null; then
            echo -e "${GREEN}MySQL running${NC}"
            break
        fi
        sleep 1
    done
else
    echo -e "${GREEN}MySQL already running${NC}"
fi

# Start bot
echo -e "${CYAN}Starting bot...${NC}"
npm run start
