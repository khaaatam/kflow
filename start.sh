#!/bin/bash

# ============================================
# K-Flow Start Script (Termux + PM2 + tmux)
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

cd ~/k-flow 2>/dev/null || cd "$(dirname "$0")"

# ============================================
# START MYSQL (MariaDB)
# ============================================
if ! pgrep -x mysqld > /dev/null 2>&1 && ! pgrep -x mariadbd > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting MariaDB...${NC}"
    mysqld_safe &
    sleep 3
    for i in {1..15}; do
        if mysqladmin ping -u root --silent 2>/dev/null; then
            echo -e "${GREEN}MariaDB running${NC}"
            break
        fi
        sleep 1
    done
else
    echo -e "${GREEN}MariaDB already running${NC}"
fi

# ============================================
# START SSH SERVER
# ============================================
if ! pgrep -x sshd > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting SSH server...${NC}"
    sshd
    echo -e "${GREEN}SSH running on port 8022${NC}"
fi

# ============================================
# START BOT (PM2 or tmux)
# ============================================

# Kalau sudah ada di tmux, jalanin langsung
if [ -n "$TMUX" ]; then
    echo -e "${CYAN}Inside tmux session — starting bot...${NC}"
    if pm2 list 2>/dev/null | grep -q "k-flow"; then
        pm2 restart k-flow
    else
        pm2 start app.js --name "k-flow" --max-memory-restart 300M --node-args="--max-old-space-size=256"
        pm2 save
    fi
    echo ""
    echo -e "${GREEN}Bot berjalan di PM2!${NC}"
    echo -e "Lihat log: ${CYAN}pm2 logs k-flow${NC}"
    echo -e "Dashboard: ${CYAN}http://localhost:3000${NC}"
    echo ""
    # Tampilkan IP
    LOCAL_IP=$(ifconfig 2>/dev/null | grep -oE 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | awk '{print $2}' | head -1)
    if [ -n "$LOCAL_IP" ]; then
        echo -e "SSH dari PC: ${CYAN}ssh $LOCAL_IP -p 8022${NC}"
    fi
    echo ""
    return 2>/dev/null || exit 0
fi

# Kalau belum di tmux, bikin session baru
if command -v tmux &>/dev/null; then
    echo -e "${CYAN}Creating tmux session...${NC}"

    # Kalau session "bot" sudah ada, attach aja
    if tmux has-session -t bot 2>/dev/null; then
        echo -e "${YELLOW}Session 'bot' exists. Attaching...${NC}"
        echo -e "Log out dengan: ${CYAN}Ctrl+B lalu d${NC}"
        echo ""
        tmux attach -t bot
    else
        echo -e "${CYAN}Starting bot in new tmux session...${NC}"
        tmux new-session -d -s bot "cd ~/k-flow 2>/dev/null || cd '$(pwd)'; bash start.sh"
        echo -e "${GREEN}Bot started in tmux session 'bot'!${NC}"
        echo ""
        echo -e "Attach ke session:"
        echo -e "  ${CYAN}tmux attach -t bot${NC}"
        echo ""
        echo -e "Log out dari tmux (bot tetap jalan):"
        echo -e "  ${CYAN}Ctrl+B lalu d${NC}"
        echo ""
        # Tampilkan IP
        LOCAL_IP=$(ifconfig 2>/dev/null | grep -oE 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | awk '{print $2}' | head -1)
        if [ -n "$LOCAL_IP" ]; then
            echo -e "SSH dari PC: ${CYAN}ssh $LOCAL_IP -p 8022${NC}"
        fi
        echo ""
    fi
else
    # Fallback tanpa tmux
    echo -e "${YELLOW}tmux not found. Starting directly...${NC}"
    if pm2 list 2>/dev/null | grep -q "k-flow"; then
        pm2 restart k-flow
    else
        pm2 start app.js --name "k-flow" --max-memory-restart 300M --node-args="--max-old-space-size=256"
        pm2 save
    fi
    echo ""
    echo -e "${GREEN}Bot berjalan di PM2!${NC}"
    echo -e "Lihat log: ${CYAN}pm2 logs k-flow${NC}"
    echo -e "Dashboard: ${CYAN}http://localhost:3000${NC}"
    echo ""
fi
